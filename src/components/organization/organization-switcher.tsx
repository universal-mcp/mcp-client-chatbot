import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { organization, useActiveOrganization } from "@/lib/auth/client";
import { ActiveOrganization, Organization } from "@/lib/auth/types";
import { useEffect, useRef } from "react";
import { appStore } from "@/app/store";

export const OrganizationSwitcher = ({
  activeOrganization,
  organizations,
}: {
  activeOrganization: ActiveOrganization | null;
  organizations: Organization[];
}) => {
  const { data: currentActiveOrg } = useActiveOrganization();
  const invalidateOrganizationData = appStore(
    (state) => state.invalidateOrganizationData,
  );
  const previousOrgId = useRef<string | null>(currentActiveOrg?.id || null);

  // Detect organization changes and invalidate SWR data
  useEffect(() => {
    const currentOrgId = currentActiveOrg?.id || null;

    // Only invalidate if the organization actually changed
    if (previousOrgId.current !== currentOrgId) {
      console.log("Organization changed, invalidating data...", {
        from: previousOrgId.current,
        to: currentOrgId,
      });

      invalidateOrganizationData();
      previousOrgId.current = currentOrgId;
    }
  }, [currentActiveOrg?.id, invalidateOrganizationData]);

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
