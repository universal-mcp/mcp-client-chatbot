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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { organization } from "@/lib/auth/client";
import { useRouter } from "next/navigation";

interface CreateOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refetchOrganizations?: () => void;
}

export const CreateOrganizationModal = ({
  open,
  onOpenChange,
  refetchOrganizations,
}: CreateOrganizationModalProps) => {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSlugEdited, setIsSlugEdited] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isSlugEdited) {
      const generatedSlug = name.trim().toLowerCase().replace(/\s+/g, "-");
      setSlug(generatedSlug);
    }
  }, [name, isSlugEdited]);

  useEffect(() => {
    if (open) {
      setName("");
      setSlug("");
      setIsSlugEdited(false);
      setLogo(null);
    }
  }, [open]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] w-11/12">
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
            <Label>Workspace Slug</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setIsSlugEdited(true);
              }}
              placeholder="workspace-slug"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Logo (Optional)</Label>
            <Input type="file" accept="image/*" onChange={handleLogoChange} />
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
            onClick={async () => {
              setLoading(true);
              await organization.create(
                {
                  name: name.trim(),
                  slug: slug.trim(),
                  logo: logo || undefined,
                },
                {
                  onResponse: () => {
                    setLoading(false);
                  },
                  onSuccess: async (ctx) => {
                    toast.success("Workspace created successfully");
                    onOpenChange(false);
                    refetchOrganizations?.();
                    // Switch to the newly created workspace
                    if (ctx.data?.id) {
                      await organization.setActive({
                        organizationId: ctx.data.id,
                      });
                      // Route to homepage after switching
                      router.push("/");
                    }
                  },
                  onError: (error) => {
                    toast.error(error.error.message);
                    setLoading(false);
                  },
                },
              );
            }}
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
