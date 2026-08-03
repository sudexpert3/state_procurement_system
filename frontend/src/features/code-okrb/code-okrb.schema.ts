import z from "zod";

export const codeOkrbSchema = z.object({
  code: z.string().trim().min(1, "Обязательное поле"),
  title: z.string().trim().min(1, "Обязательное поле"),
  is_active: z.boolean(),
});

export type CodeOkrbValues = z.infer<typeof codeOkrbSchema>;
