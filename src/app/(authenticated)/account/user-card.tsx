"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient, signOut } from "@/lib/auth/client";
import { Session } from "@/lib/auth/types";
import {
  Edit,
  Loader2,
  LogOut,
  X,
  SmartphoneIcon,
  LaptopIcon,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { UAParser } from "ua-parser-js";
import { useTranslations } from "next-intl";

export default function UserCard(props: {
  session: Session | null;
  activeSessions: Session["session"][];
}) {
  const router = useRouter();
  const session = props.session;
  const [isTerminating, setIsTerminating] = useState<string>();
  const [isSignOut, setIsSignOut] = useState<boolean>(false);
  const [emailVerificationPending, setEmailVerificationPending] =
    useState<boolean>(false);
  const [activeSessions, setActiveSessions] = useState(props.activeSessions);
  const removeActiveSession = (id: string) =>
    setActiveSessions(activeSessions.filter((session) => session.id !== id));
  const t = useTranslations("Auth.Account");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg md:text-xl font-bold text-foreground">
          {t("userTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-8 grid-cols-1">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="hidden h-12 w-12 sm:flex ">
                <AvatarImage
                  src={session?.user.image || undefined}
                  alt="Avatar"
                  className="object-cover"
                />
                <AvatarFallback>{session?.user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="grid">
                <div className="flex items-center gap-1">
                  <p className="text-base font-semibold leading-none text-foreground">
                    {session?.user.name}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {session?.user.email}
                </p>
              </div>
            </div>
            <EditUserDialog />
          </div>
        </div>

        {session?.user.emailVerified ? (
          <Alert className="mt-4" variant="default">
            <AlertTitle>
              <span className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="1.2em"
                  height="1.2em"
                  viewBox="0 0 24 24"
                  className="text-green-500"
                >
                  <path
                    fill="currentColor"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                  />
                </svg>
                Email verified
              </span>
            </AlertTitle>
          </Alert>
        ) : (
          <Alert className="mt-4" variant="destructive">
            <AlertTitle>
              <span className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="1.2em"
                  height="1.2em"
                  viewBox="0 0 24 24"
                  className="text-yellow-500"
                >
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"
                  />
                </svg>
                {t("emailVerificationTitle")}
              </span>
            </AlertTitle>
            <AlertDescription className="text-muted-foreground mt-1">
              {t("emailVerificationDescription")}
            </AlertDescription>
            <div className="flex items-center gap-2 mt-4">
              <Button
                size="sm"
                variant="secondary"
                disabled={emailVerificationPending}
                onClick={async () => {
                  if (!session?.user.email) {
                    toast.error(t("noEmailFound"));
                    return;
                  }
                  await authClient.sendVerificationEmail(
                    {
                      email: session.user.email,
                      callbackURL: "/account",
                    },
                    {
                      onRequest() {
                        setEmailVerificationPending(true);
                      },
                      onError(context) {
                        toast.error(context.error.message);
                        setEmailVerificationPending(false);
                      },
                      onSuccess() {
                        toast.success(t("verificationSent"));
                        setEmailVerificationPending(false);
                      },
                    },
                  );
                }}
              >
                {emailVerificationPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin mr-2" />
                    {t("sending")}
                  </>
                ) : (
                  t("resendVerification")
                )}
              </Button>
            </div>
          </Alert>
        )}

        <div className="flex flex-col gap-2 mt-6">
          <p className="text-sm font-semibold text-foreground mb-1">
            Active Sessions
          </p>
          <div className="border-l-2 border-border px-2 w-max gap-1 flex flex-col">
            {activeSessions
              .filter((session) => session.userAgent)
              .map((session) => {
                return (
                  <div key={session.id}>
                    <div className="flex items-center gap-2 text-sm  text-black font-medium dark:text-white">
                      {new UAParser(session.userAgent || "").getDevice()
                        .type === "mobile" ? (
                        <SmartphoneIcon />
                      ) : (
                        <LaptopIcon size={16} />
                      )}
                      {new UAParser(session.userAgent || "").getOS().name},{" "}
                      {new UAParser(session.userAgent || "").getBrowser().name}
                      <button
                        className="text-red-500 opacity-80  cursor-pointer text-xs border-muted-foreground border-red-600  underline "
                        onClick={async () => {
                          setIsTerminating(session.id);
                          const res = await authClient.revokeSession({
                            token: session.token,
                          });

                          if (res.error) {
                            toast.error(res.error.message);
                          } else {
                            toast.success("Session terminated successfully");
                            removeActiveSession(session.id);
                          }
                          if (session.id === props.session?.session.id)
                            router.refresh();
                          setIsTerminating(undefined);
                        }}
                      >
                        {isTerminating === session.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : session.id === props.session?.session.id ? (
                          "Sign Out"
                        ) : (
                          "Terminate"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2 justify-between items-center">
        <ChangePassword />

        <Button
          className="gap-2 z-10"
          variant="secondary"
          onClick={async () => {
            setIsSignOut(true);
            await signOut({
              fetchOptions: {
                onSuccess() {
                  router.push("/");
                },
              },
            });
            setIsSignOut(false);
          }}
          disabled={isSignOut}
        >
          <span className="text-sm">
            {isSignOut ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <LogOut size={16} />
                Sign Out
              </div>
            )}
          </span>
        </Button>
      </CardFooter>
    </Card>
  );
}

async function handleUpdate(image: File, name: string | undefined) {
  const imageName = `${crypto.randomUUID()}-${image.name}`;
  let presignedUrl = "";
  try {
    const res = await fetch("/api/r2/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: imageName,
        contentType: image.type,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to get presigned URL");
    }

    console.log(res);

    const data = await res.json();
    presignedUrl = data.signedUrl;
  } catch (_e) {
    toast.error("Failed to get presigned URL");
    return;
  }

  try {
    const res = await fetch(presignedUrl, {
      method: "PUT",
      body: image,
      headers: {
        "Content-Type": image.type,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to upload image");
    }
  } catch (_e) {
    toast.error("Failed to upload image");
    return;
  }

  await authClient.updateUser({
    image: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${imageName}`,
    name,
    fetchOptions: {
      onSuccess: () => {
        toast.success("User updated successfully");
      },
      onError: (error) => {
        toast.error(error.error.message);
      },
    },
  });
}

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [signOutDevices, setSignOutDevices] = useState<boolean>(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 z-10" variant="secondary" size="sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M2.5 18.5v-1h19v1zm.535-5.973l-.762-.442l.965-1.693h-1.93v-.884h1.93l-.965-1.642l.762-.443L4 9.066l.966-1.643l.761.443l-.965 1.642h1.93v.884h-1.93l.965 1.693l-.762.442L4 10.835zm8 0l-.762-.442l.966-1.693H9.308v-.884h1.93l-.965-1.642l.762-.443L12 9.066l.966-1.643l.761.443l-.965 1.642h1.93v.884h-1.93l.965 1.693l-.762.442L12 10.835zm8 0l-.762-.442l.966-1.693h-1.931v-.884h1.93l-.965-1.642l.762-.443L20 9.066l.966-1.643l.761.443l-.965 1.642h1.93v.884h-1.93l.965 1.693l-.762.442L20 10.835z"
            ></path>
          </svg>
          <span className="text-sm">Change Password</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] w-11/12">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>Change your password</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="current-password">Current Password</Label>
          <PasswordInput
            id="current-password"
            value={currentPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCurrentPassword(e.target.value)
            }
            autoComplete="new-password"
            placeholder="Password"
          />
          <Label htmlFor="new-password">New Password</Label>
          <PasswordInput
            value={newPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewPassword(e.target.value)
            }
            autoComplete="new-password"
            placeholder="New Password"
          />
          <Label htmlFor="password">Confirm Password</Label>
          <PasswordInput
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setConfirmPassword(e.target.value)
            }
            autoComplete="new-password"
            placeholder="Confirm Password"
          />
          <div className="flex gap-2 items-center">
            <Checkbox
              onCheckedChange={(checked) =>
                checked ? setSignOutDevices(true) : setSignOutDevices(false)
              }
            />
            <p className="text-sm">Sign out from other devices</p>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              if (newPassword !== confirmPassword) {
                toast.error("Passwords do not match");
                return;
              }
              if (newPassword.length < 8) {
                toast.error("Password must be at least 8 characters");
                return;
              }
              setLoading(true);
              const res = await authClient.changePassword({
                newPassword: newPassword,
                currentPassword: currentPassword,
                revokeOtherSessions: signOutDevices,
              });
              setLoading(false);
              if (res.error) {
                toast.error(
                  res.error.message ||
                    "Couldn't change your password! Make sure it's correct",
                );
              } else {
                setOpen(false);
                toast.success("Password changed successfully");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }
            }}
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              "Change Password"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog() {
  const t = useTranslations("Auth.Account");
  const { data } = authClient.useSession();
  const [name, setName] = useState<string>();
  const router = useRouter();
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setImageFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    setImageFileName(null);
    const fileInput = document.getElementById(
      "image-upload",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };
  const [open, setOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" variant="secondary">
          <Edit size={13} />
          {t("editUser")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] w-11/12">
        <DialogHeader>
          <DialogTitle>{t("editUser")}</DialogTitle>
          <DialogDescription>{t("editUser")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="name">{t("name")}</Label>
          <Input
            id="name"
            type="name"
            placeholder={data?.user.name}
            required
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setName(e.target.value);
            }}
          />
          <div className="flex flex-col gap-2">
            <Label>Profile Image (Optional)</Label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="image-upload"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <label htmlFor="image-upload" className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  {image ? "Change Image" : "Upload Image"}
                </label>
              </Button>
              {image && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {imageFileName && (
              <p className="text-sm text-muted-foreground truncate">
                Selected: {imageFileName}
              </p>
            )}
            {imagePreview && (
              <div className="mt-2">
                <Image
                  src={imagePreview}
                  alt="Profile preview"
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
            disabled={isLoading}
            onClick={async () => {
              setIsLoading(true);
              if (image) {
                await handleUpdate(image, name);
              } else {
                await authClient.updateUser({
                  name: name ? name : undefined,
                  fetchOptions: {
                    onSuccess: () => {
                      toast.success(t("userUpdated"));
                    },
                    onError: (error) => {
                      toast.error(error.error.message);
                    },
                  },
                });
              }
              setName("");
              router.refresh();
              setImage(null);
              setImagePreview(null);
              setImageFileName(null);
              setIsLoading(false);
              setOpen(false);
            }}
          >
            {isLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              t("update")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
