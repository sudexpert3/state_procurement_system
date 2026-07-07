import { toast } from "sonner";

export const handleHttpError = (
  error: unknown,
  defaultMessage = "Неизвестная ошибка",
  print = false,
) => {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;

  if (print) {
    // eslint-disable-next-line no-console
    console.log({
      message: defaultMessage,
      description: errorMessage,
    });

    toast.error(defaultMessage, {
      description: errorMessage,
      duration: 3000,
      position: "top-center",
      richColors: true,
    });
  }
};
