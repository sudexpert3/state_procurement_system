import type { Toaster } from "./toast-types";

import { type ExternalToast, toast } from "sonner";

export class ToastService implements Toaster {
  showSuccess(message: string, config?: ExternalToast) {
    toast.success(message, { duration: 1000, richColors: true, ...config });
  }
  showError(message: string, config?: ExternalToast) {
    toast.error(message, { duration: 1000, richColors: true, ...config });
  }
  showWarning(message: string, config?: ExternalToast) {
    toast.warning(message, { duration: 1000, richColors: true, ...config });
  }
  showInfo(message: string, config?: ExternalToast) {
    toast.info(message, { duration: 1000, richColors: true, ...config });
  }
}

export const toastService = new ToastService();
