import { type AxiosInstance } from "axios";

export class CrudService<T, C = Partial<T>> {
  private api: AxiosInstance;

  constructor(api: AxiosInstance) {
    this.api = api;
  }

  getAll = async (url: string) => {
    const res = await this.api.get<T>(url);
    const data = await res.data;
    return data;
  };

  getById = async (url: string, id: string) => {
    const res = await this.api.get<T>(url, { params: { id } });
    const data = await res.data;
    return data;
  };

  create = async (url: string, payload: C) => {
    const res = await this.api.post<T>(url, payload);
    // const data = await res.data;
    return res;
  };

  update = async (url: string, id: string, payload: C) => {
    const res = await this.api.patch<T>(url, payload, {
      params: { id },
    });
    const data = await res.data;
    return data;
  };

  delete = async (url: string, id: string) => {
    const res = await this.api.delete<T>(url, { params: { id } });
    const data = await res.data;
    return data;
  };
}
