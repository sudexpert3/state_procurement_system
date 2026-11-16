import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import { useNavigate } from "react-router";

import { useCurrentUser } from "@/services/auth";
import { clearTokens } from "@/shared/api/auth-tokens";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import { ROUTES } from "@/shared/model/routes";

import { Avatar, AvatarFallback } from "../../shared/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../shared/components/ui/dropdown-menu";

export function NavUser() {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();

  // Подпись пользователя — фамилия + инициал имени ("Иванов И."), если
  // фамилия заполнена; иначе логин (не у всех учётных записей есть ФИО).
  const signature = currentUser?.last_name
    ? `${currentUser.last_name}${currentUser.first_name ? ` ${currentUser.first_name.charAt(0).toUpperCase()}.` : ""}`
    : currentUser?.username;

  const user = {
    name: signature ?? "…",
    role: currentUser?.role_display ?? "",
    initial:
      (
        currentUser?.last_name?.[0] ?? currentUser?.username?.[0]
      )?.toUpperCase() ?? "?",
  };

  const logout = () => {
    clearTokens();
    navigate(ROUTES.LOGIN);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {user.initial}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.role}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {user.initial}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.role}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOutIcon />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
