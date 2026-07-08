import * as React from "react";

import {
  BookOpen,
  CalendarRange,
  GalleryVerticalEnd,
  SquareTerminal,
  UniversityIcon,
} from "lucide-react";

import { Separator } from "@/shared/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
} from "@/shared/components/ui/sidebar";
import { ROUTES } from "@/shared/model/routes";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

const data = {
  user: {
    name: "shadcn",
    role: "Администратор",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Закупки",
      logo: <GalleryVerticalEnd />,
      // plan: "Enterprise",
    },
  ],
  navMain: [
    {
      title: "Годовые планы",
      url: ROUTES.PLANS,
      icon: <CalendarRange />,
    },
    {
      title: "Реестр закупок",
      url: ROUTES.PLAN_ITEMS,
      icon: <SquareTerminal />,
    },
    {
      title: "Справочники",
      url: "#",
      icon: <BookOpen />,
      isActive: true,
      items: [
        {
          title: "ЭКР",
          url: ROUTES.ECONOMIC_CLASSIFIER,
        },
        {
          title: "Коды ОКРБ",
          url: ROUTES.CODES,
        },
        {
          title: "Главки",
          url: ROUTES.DEPARTMENTS,
        },
        {
          title: "Исполнители",
          url: ROUTES.USERS,
        },
        {
          title: "Корректировка лимитов",
          url: "#",
        },
        {
          title: "Для кого закупка",
          url: ROUTES.BUYERS,
        },
        {
          title: "Поставщики",
          url: ROUTES.SUPPLIERS,
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
            <UniversityIcon />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">Закупки</span>
          </div>
        </SidebarMenuButton>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
