import MCPEditor from "@/components/mcp-editor";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations();
  return (
    <div className="container max-w-3xl mx-0 px-4 sm:mx-4 md:mx-auto py-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/mcp"
          className="flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3" />
          {t("Common.back")}
        </Link>
        <header>
          <h2 className="text-3xl font-semibold my-2">
            {t("MCP.mcpConfiguration")}
          </h2>
          <p className="text text-muted-foreground">
            {t("MCP.configureYourMcpServerConnectionSettings")}
          </p>
        </header>

        <main className="my-8">
          <MCPEditor />
        </main>
      </div>
    </div>
  );
}
