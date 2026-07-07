import { Outlet } from "react-router";

export const App = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <Outlet />
    </div>
  );
};
