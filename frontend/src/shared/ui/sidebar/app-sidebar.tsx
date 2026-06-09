import * as React from "react";

import {
  AudioWaveform,
  BookOpen,
  Command,
  GalleryVerticalEnd,
  SquareTerminal,
} from "lucide-react";

import { ROUTES } from "@/shared/model/routes";
import { Separator } from "@/shared/ui/kit/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/shared/ui/kit/sidebar";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { TeamSwitcher } from "./team-switcher";

const data = {
  user: {
    name: "shadcn",
    role: "Администратор",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Acme Inc",
      logo: <GalleryVerticalEnd />,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: <AudioWaveform />,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: <Command />,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Реестр",
      url: ROUTES.PROCUREMENTS,
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
          url: "#",
        },
        {
          title: "Коды ОКРБ",
          url: ROUTES.CODES,
        },
        {
          title: "Главки",
          url: "#",
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
          url: "#",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
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
