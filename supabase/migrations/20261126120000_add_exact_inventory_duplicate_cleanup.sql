CREATE OR REPLACE FUNCTION public.delete_exact_duplicate_inventory_batches(p_duplicate_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_duplicate_id UUID;
  v_duplicate public.drugs%ROWTYPE;
  v_keeper_id UUID;
  v_deleted_count INTEGER := 0;
  v_rows INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to remove duplicate inventory batches.';
  END IF;

  v_owner_id := public.current_clinic_owner_id();
  IF NOT public.can_manage_clinic_inventory()
    OR (auth.uid() <> v_owner_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only the clinic owner or an authorized administrator can remove duplicate inventory batches.';
  END IF;

  FOR v_duplicate_id IN
    SELECT DISTINCT unnest(COALESCE(p_duplicate_ids, ARRAY[]::UUID[]))
  LOOP
    SELECT * INTO v_duplicate
    FROM public.drugs
    WHERE id = v_duplicate_id AND user_id = v_owner_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'An inventory batch was not found in this clinic.';
    END IF;

    v_keeper_id := NULL;
    SELECT candidate.id INTO v_keeper_id
    FROM public.drugs AS candidate
    WHERE candidate.user_id = v_owner_id
      AND candidate.name = v_duplicate.name
      AND candidate.serial_number IS NOT DISTINCT FROM v_duplicate.serial_number
      AND candidate.expiry_date IS NOT DISTINCT FROM v_duplicate.expiry_date
      AND candidate.date_of_purchase IS NOT DISTINCT FROM v_duplicate.date_of_purchase
      AND candidate.buying_price = v_duplicate.buying_price
      AND candidate.selling_price = v_duplicate.selling_price
      AND candidate.stock_quantity = v_duplicate.stock_quantity
      AND candidate.low_stock_threshold = v_duplicate.low_stock_threshold
    ORDER BY candidate.created_at ASC, candidate.id ASC
    LIMIT 1
    FOR UPDATE;

    IF v_keeper_id IS NULL OR v_keeper_id = v_duplicate.id THEN
      RAISE EXCEPTION 'A selected batch is not an exact duplicate. Refresh inventory and try again.';
    END IF;

    -- Keep historical sales, stock movements, and online product links attached to the retained batch.
    UPDATE public.transactions
    SET drug_id = v_keeper_id
    WHERE user_id = v_owner_id AND drug_id = v_duplicate.id;

    UPDATE public.inventory_movements
    SET drug_id = v_keeper_id
    WHERE user_id = v_owner_id AND drug_id = v_duplicate.id;

    UPDATE public.ecommerce_products AS product
    SET inventory_drug_id = v_keeper_id
    FROM public.ecommerce_stores AS store
    WHERE product.inventory_drug_id = v_duplicate.id
      AND product.store_id = store.id
      AND store.owner_user_id = v_owner_id;

    DELETE FROM public.drugs
    WHERE id = v_duplicate.id AND user_id = v_owner_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'Could not remove the duplicate inventory batch.';
    END IF;

    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_exact_duplicate_inventory_batches(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_exact_duplicate_inventory_batches(UUID[]) TO authenticated;
