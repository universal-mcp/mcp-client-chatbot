import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { organization } from "@/lib/auth/client";
import { ActiveOrganization, Organization } from "@/lib/auth/types";

export const OrganizationSwitcher = ({
  activeOrganization,
  organizations,
}: {
  activeOrganization: ActiveOrganization | null;
  organizations: Organization[];
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-1 cursor-pointer">
          <p className="text-sm text-foreground">
            <span className="font-bold"></span>{" "}
            {activeOrganization?.name || "Personal"}
          </p>
          <ChevronDown />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          className=" py-1"
          onClick={async () => {
            organization.setActive({
              organizationId: null,
            });
          }}
        >
          <p className="text-sm sm">Personal</p>
        </DropdownMenuItem>
        {organizations?.map((org) => (
          <DropdownMenuItem
            className=" py-1"
            key={org.id}
            onClick={async () => {
              if (org.id === activeOrganization?.id) {
                return;
              }
              await organization.setActive({
                organizationId: org.id,
              });
            }}
          >
            <p className="text-sm sm">{org.name}</p>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
