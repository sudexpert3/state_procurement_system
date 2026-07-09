import z from "zod";

export const codeOkrbSchema = z.object({
  code: z.string().min(1, "Обязательное поле"),
  title: z.string().min(1, "Обязательное поле"),
  is_active: z.boolean(),
});

export type CodeOkrbValues = z.input<typeof codeOkrbSchema>;
