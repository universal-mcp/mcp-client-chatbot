import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function InvitationError() {
  const t = useTranslations("Auth.Invitation");
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-6 h-6 text-destructive" />
          <CardTitle className="text-xl text-destructive">
            {t("errorTitle")}
          </CardTitle>
        </div>
        <CardDescription>{t("errorDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("errorDetails")}
        </p>
      </CardContent>
      <CardFooter>
        <Link href="/" className="w-full">
          <Button variant="outline" className="w-full">
            {t("backToHome")}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
