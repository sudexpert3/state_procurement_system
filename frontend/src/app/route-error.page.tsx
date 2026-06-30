import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";

import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/model/routes";

export const RouteErrorPage = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  const getErrorMessage = () => {
    if (isRouteErrorResponse(error)) {
      return `${error.status} — ${error.statusText}`;
    } else if (error instanceof Error) {
      return error.message;
    }
    return "Unknown Error";
  };

  const goHome = () => {
    try {
      navigate(ROUTES.HOME);
    } catch {
      window.location.assign(ROUTES.HOME);
    }
  };

  return (
    <div>
      <h1>Произошла ошибка</h1>
      <p>{getErrorMessage()}</p>
      <Button onClick={goHome}>Вернуться на главную</Button>
    </div>
  );
};
