import * as React from "react";

import {
  BarChart3,
  BookOpen,
  CalendarRange,
  FileCheck2,
  FileText,
  GalleryVerticalEnd,
  SquareTerminal,
  UniversityIcon,
  Wallet,
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
      title: "Заявки на изменение",
      url: ROUTES.CHANGE_REQUESTS,
      icon: <FileCheck2 />,
    },
    {
      title: "Договоры",
      url: ROUTES.CONTRACTS,
      icon: <FileText />,
    },
    {
      title: "Платежи",
      url: ROUTES.PAYMENTS,
      icon: <Wallet />,
    },
    {
      title: "Отчёты",
      url: ROUTES.REPORTS,
      icon: <BarChart3 />,
    },
    {
      title: "Справочники",
      url: "#",
      icon: <BookOpen />,
      isActive: true,
      items: [
        {
          title: "ЭКР",
          url: ROUTES.ECONOMIC_CODE,
        },
        {
          title: "Коды ОКРБ",
          url: ROUTES.CODES_OKRB,
        },
        {
          title: "Главки",
          url: ROUTES.DEPARTMENTS,
        },
        {
          title: "Внутренние коды ЭКР",
          url: ROUTES.INTERNAL_ECONOMIC_CODE,
        },
        {
          title: "Корректировка лимитов",
          url: ROUTES.LIMIT_CALIBRATION,
        },
        {
          title: "Закупщики",
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
      <SidebarHeader className="p-1">
        <SidebarMenuButton
          size="sm"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-6 items-center justify-center rounded-lg">
            <UniversityIcon className="size-4" />
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
