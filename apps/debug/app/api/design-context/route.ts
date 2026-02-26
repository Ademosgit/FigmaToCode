import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

/**
 * API-Route für "Send to Cursor": Schreibt Design-Daten in .cursor/design-context.json
 * Wird vom Figma-Plugin per POST aufgerufen, wenn der Debug-Server läuft.
 *
 * Projektroot: Eine Ebene über apps/debug (Monorepo-Root) oder FIGMA_TO_CODE_PROJECT_ROOT
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { framework, code, figmaNodes, timestamp } = body;

    if (!framework || !code || !figmaNodes) {
      return NextResponse.json(
        { error: "framework, code und figmaNodes sind erforderlich" },
        { status: 400 }
      );
    }

    const designContext = {
      framework,
      code,
      figmaNodes,
      timestamp: timestamp ?? Date.now(),
    };

    const projectRoot =
      process.env.FIGMA_TO_CODE_PROJECT_ROOT ??
      path.resolve(process.cwd(), "..");
    const cursorDir = path.join(projectRoot, ".cursor");
    const filePath = path.join(cursorDir, "design-context.json");

    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(designContext, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      path: filePath,
    });
  } catch (err) {
    console.error("[design-context] Error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
