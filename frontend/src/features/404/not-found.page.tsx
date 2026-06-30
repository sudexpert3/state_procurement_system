import { useNavigate } from "react-router";

import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/model/routes";

const NotFoundPage = () => {
  const navigate = useNavigate();

  const handleClick = () => navigate(ROUTES.HOME);

  return (
    <div className="mt-10 grid place-items-center gap-2.5">
      <h1 className="text-3xl">404 - Not Found </h1>
      <p>Страница, которую ты ищешь, не существует :(</p>
      <Button onClick={handleClick}>Перейти на главную</Button>
    </div>
  );
};

export const Component = NotFoundPage;
