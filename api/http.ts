export type ApiRequest = {
  method?: string;
  body?: unknown;
};

export type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => ApiResponse;
  json: (payload: unknown) => void;
};
