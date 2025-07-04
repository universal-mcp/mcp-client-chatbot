"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import {
  organization,
  useListOrganizations,
  useSession,
} from "@/lib/auth/client";
import { appStore } from "@/app/store";
import { useRouter } from "next/navigation";

interface CreateOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Function to generate a short hash from user ID
const generateUserHash = async (userId: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  // Convert to hex and take first 8 characters for a short hash
  const hashHex = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 8);
  return hashHex;
};

export const CreateOrganizationModal = ({
  open,
  onOpenChange,
}: CreateOrganizationModalProps) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const handleSwitchOrganization = appStore(
    (state) => state.handleSwitchOrganization,
  );
  const { refetch: refetchOrganizations } = useListOrganizations();
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setName("");
      setLogo(null);
      setLogoFileName(null);
    }
  }, [open]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    setLogoFileName(null);
    // Reset the file input
    const fileInput = document.getElementById(
      "logo-upload",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleCreateWorkspace = async () => {
    if (loading || !name.trim() || !session?.user?.id) return;

    setLoading(true);

    // Generate slug when creating the organization
    const baseSlug = name.trim().toLowerCase().replace(/\s+/g, "-");
    const userHash = await generateUserHash(session.user.id);
    const generatedSlug = `${baseSlug}-${userHash}`;

    await organization.create(
      {
        name: name.trim(),
        slug: generatedSlug,
        logo: logo || undefined,
      },
      {
        onResponse: () => {
          setLoading(false);
        },
        onSuccess: async (ctx) => {
          toast.success("Workspace created successfully");
          onOpenChange(false);
          // Switch to the newly created workspace
          await handleSwitchOrganization(ctx.data?.id || null);
          refetchOrganizations();
          router.push("/");
        },
        onError: (error) => {
          toast.error(
            error.error.message === "Organization already exists"
              ? "Workspace already exists"
              : error.error.message,
          );
          setLoading(false);
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && name.trim()) {
      e.preventDefault();
      handleCreateWorkspace();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px] w-11/12"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Create a new organization workspace to collaborate with your team.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Workspace Name</Label>
            <Input
              placeholder="Enter workspace name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Logo (Optional)</Label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="logo-upload"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <label htmlFor="logo-upload" className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  {logo ? "Change Logo" : "Upload Logo"}
                </label>
              </Button>
              {logo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={handleRemoveLogo}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {logoFileName && (
              <p className="text-sm text-muted-foreground truncate">
                Selected: {logoFileName}
              </p>
            )}
            {logo && (
              <div className="mt-2">
                <Image
                  src={logo}
                  alt="Logo preview"
                  className="w-16 h-16 object-cover rounded-md"
                  width={64}
                  height={64}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            disabled={loading || !name.trim()}
            onClick={handleCreateWorkspace}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} />
                Creating...
              </>
            ) : (
              "Create Workspace"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
