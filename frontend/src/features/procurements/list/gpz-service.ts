import { CrudService } from "@/shared/api/crud-service";
import { gpzApi } from "@/shared/api/http";

class GpzService extends CrudService<unknown> {
  constructor() {
    super(gpzApi);
  }
}

export const gpzService = new GpzService();
