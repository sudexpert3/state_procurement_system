import { Navigate, Outlet, redirect } from "react-router"

import { ROUTES } from "@/shared/model/routes"

export const ProtectedRoute = () => {
  const token = localStorage.getItem("token")

  if (!token) {
    return <Navigate to={ROUTES.LOGIN} />
  }

  return <Outlet />
}

export const protectedLoader = () => {
  const token = localStorage.getItem("token")
  if (!token) {
    return redirect(ROUTES.LOGIN)
  }
  return null
}
