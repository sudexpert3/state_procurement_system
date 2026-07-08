import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import z from "zod";

import { Button } from "@/shared/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { ROUTES } from "@/shared/model/routes";

const loginSchema = z.object({
  login: z.string().min(1, "Обязательное поле"),
  password: z.string().min(5, "Пароль должен быть не менее 5 символов"),
});

type LoginInput = z.input<typeof loginSchema>;

export const LoginForm = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const { handleSubmit, control } = useForm<LoginInput>({
    defaultValues: {
      login: "",
      password: "",
    },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = handleSubmit((data) => {
    if (data.login === "admin" && data.password === "admin") {
      localStorage.setItem("token", "true");
      navigate(ROUTES.PLAN_ITEMS);
    } else {
      setError("Неправильный логин или пароль");
    }
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <Controller
        name="login"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="form-login">Логин</FieldLabel>
            <Input
              id="form-login"
              placeholder="admin"
              aria-invalid={fieldState.invalid}
              {...field}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="password"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="form-password">Пароль</FieldLabel>
            <Input
              id="form-password"
              type="password"
              placeholder="******"
              autoComplete="on"
              aria-invalid={fieldState.invalid}
              {...field}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
      <Button type="submit">Войти</Button>
    </form>
  );
};
