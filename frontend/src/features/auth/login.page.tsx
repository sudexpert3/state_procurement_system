import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/kit/card"

import { LoginForm } from "./login-form"

const LoginPage = () => {
  return (
    <main className="flex grow items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Вход в систему</CardTitle>
          <CardDescription>
            Введите логин и пароль для входа в систему
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}

export const Component = LoginPage
