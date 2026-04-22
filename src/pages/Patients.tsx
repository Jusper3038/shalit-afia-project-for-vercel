import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/lib/audit";
import { exportToCSV } from "@/lib/csv-export";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const PatientsPage = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Tables<"patients">[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"patients"> | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", diagnosis: "" });

  const fetchPatients = async () => {
    if (!user) return;
    const { data } = await supabase.from("patients").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setPatients(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchPatients(); }, [user]);

  const resetForm = () => { setForm({ name: "", phone: "", diagnosis: "" }); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = { user_id: user.id, name: form.name, phone: form.phone, diagnosis: form.diagnosis };

    if (editing) {
      const { error } = await supabase.from("patients").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      await logAudit("Updated patient", form.name);
      toast.success("Patient updated!");
    } else {
      const { error } = await supabase.from("patients").insert(payload);
      if (error) { toast.error(error.message); return; }
      await logAudit("Added patient", form.name);
      toast.success("Patient added!");
    }
    setDialogOpen(false);
    resetForm();
    fetchPatients();
  };

  const handleEdit = (p: Tables<"patients">) => {
    setEditing(p);
    setForm({ name: p.name, phone: p.phone ?? "", diagnosis: p.diagnosis ?? "" });
    setDialogOpen(true);
  };

  const handleDelete = async (p: Tables<"patients">) => {
    if (!confirm(`Delete patient "${p.name}"?`)) return;
    const { error } = await supabase.from("patients").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    await logAudit("Deleted patient", p.name);
    toast.success("Patient deleted!");
    fetchPatients();
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Patients</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToCSV(patients.map(p => ({ Name: p.name, Phone: p.phone, Diagnosis: p.diagnosis })), "patients-report")}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Patient</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit Patient" : "Add Patient"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Diagnosis</Label><Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>
                  <Button type="submit" className="w-full">{editing ? "Update" : "Add"} Patient</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : patients.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No patients yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.phone || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{p.diagnosis || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PatientsPage;
