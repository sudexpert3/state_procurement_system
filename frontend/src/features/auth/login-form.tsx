import type { ApiSchemas } from "@/shared/api/schema";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import z from "zod";

import { setTokens } from "@/shared/api/auth-tokens";
import { rqClient } from "@/shared/api/instance";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { ROUTES } from "@/shared/model/routes";

const loginSchema = z.object({
  login: z.string().min(1, "Обязательное поле"),
  password: z.string().min(1, "Обязательное поле"),
});

type LoginInput = z.input<typeof loginSchema>;

export const LoginForm = () => {
  const navigate = useNavigate();

  const loginMutation = rqClient.useMutation("post", "/api/auth/token/");

  const { handleSubmit, control, setError } = useForm<LoginInput>({
    defaultValues: {
      login: "",
      password: "",
    },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = handleSubmit((data) => {
    loginMutation.mutate(
      {
        // `TokenObtainPair` в сгенерированной схеме требует и readonly
        // access/refresh на вход (DRF их игнорирует) — тот же приём, что и
        // в остальных create-мутациях проекта (см. CurrentStatus.md).
        body: {
          username: data.login,
          password: data.password,
        } as unknown as ApiSchemas["TokenObtainPair"],
      },
      {
        onSuccess: ({ access, refresh }) => {
          setTokens(access, refresh);
          navigate(ROUTES.PLAN_ITEMS);
        },
        onError: () => {
          setError("password", { message: "Неправильный логин или пароль" });
        },
      },
    );
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
              placeholder="Логин"
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
      <Button type="submit" disabled={loginMutation.isPending}>
        {loginMutation.isPending && (
          <Loader2Icon size={16} className="animate-spin" />
        )}
        Войти
      </Button>
    </form>
  );
};
