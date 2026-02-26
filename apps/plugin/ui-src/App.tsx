import { useEffect, useState } from "react";
import { PluginUI } from "plugin-ui";
import {
  Framework,
  PluginSettings,
  ConversionMessage,
  Message,
  HTMLPreview,
  LinearGradientConversion,
  SolidColorConversion,
  ErrorMessage,
  SettingsChangedMessage,
  Warning,
  SendToCursorDataMessage,
} from "types";
import {
  postUISettingsChangingMessage,
  postSendToCursorRequest,
} from "./messaging";
import copy from "copy-to-clipboard";

interface AppState {
  code: string;
  selectedFramework: Framework;
  isLoading: boolean;
  htmlPreview: HTMLPreview;
  settings: PluginSettings | null;
  colors: SolidColorConversion[];
  gradients: LinearGradientConversion[];
  warnings: Warning[];
}

const emptyPreview = { size: { width: 0, height: 0 }, content: "" };

export default function App() {
  const [state, setState] = useState<AppState>({
    code: "",
    selectedFramework: "HTML",
    isLoading: false,
    htmlPreview: emptyPreview,
    settings: null,
    colors: [],
    gradients: [],
    warnings: [],
  });

  const rootStyles = getComputedStyle(document.documentElement);
  const figmaColorBgValue = rootStyles
    .getPropertyValue("--figma-color-bg")
    .trim();

  useEffect(() => {
    window.onmessage = (event: MessageEvent) => {
      const untypedMessage = event.data.pluginMessage as Message;
      console.log("[ui] message received:", untypedMessage);

      switch (untypedMessage.type) {
        case "conversionStart":
          setState((prevState) => ({
            ...prevState,
            code: "",
            isLoading: true,
          }));
          break;

        case "code":
          const conversionMessage = untypedMessage as ConversionMessage;
          setState((prevState) => ({
            ...prevState,
            ...conversionMessage,
            selectedFramework: conversionMessage.settings.framework,
            isLoading: false,
          }));
          break;

        case "pluginSettingChanged":
          const settingsMessage = untypedMessage as SettingsChangedMessage;
          setState((prevState) => ({
            ...prevState,
            settings: settingsMessage.settings,
            selectedFramework: settingsMessage.settings.framework,
          }));
          break;

        case "empty":
          // const emptyMessage = untypedMessage as EmptyMessage;
          setState((prevState) => ({
            ...prevState,
            code: "",
            htmlPreview: emptyPreview,
            warnings: [],
            colors: [],
            gradients: [],
            isLoading: false,
          }));
          break;

        case "error":
          const errorMessage = untypedMessage as ErrorMessage;

          setState((prevState) => ({
            ...prevState,
            colors: [],
            gradients: [],
            code: `Error :(\n// ${errorMessage.error}`,
            isLoading: false,
          }));
          break;

        case "selection-json":
          const json = event.data.pluginMessage.data;
          copy(JSON.stringify(json, null, 2));
          break;

        case "send-to-cursor-data": {
          const data = untypedMessage as SendToCursorDataMessage;
          if (data.error) {
            console.error("[send-to-cursor]", data.error);
            break;
          }
          if (data.framework && data.code && data.figmaNodes !== undefined) {
            fetch("http://127.0.0.1:3000/api/design-context", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                framework: data.framework,
                code: data.code,
                figmaNodes: data.figmaNodes,
                timestamp: data.timestamp ?? Date.now(),
              }),
            })
              .then((res) => res.json())
              .then((result) => {
                if (result.success) {
                  console.log("[send-to-cursor] Gespeichert:", result.path);
                } else {
                  console.error("[send-to-cursor]", result.error);
                }
              })
              .catch((err) => console.error("[send-to-cursor]", err));
          }
          break;
        }

        default:
          break;
      }
    };

    return () => {
      window.onmessage = null;
    };
  }, []);

  const handleFrameworkChange = (updatedFramework: Framework) => {
    if (updatedFramework !== state.selectedFramework) {
      setState((prevState) => ({
        ...prevState,
        // code: "// Loading...",
        selectedFramework: updatedFramework,
      }));
      postUISettingsChangingMessage("framework", updatedFramework, {
        targetOrigin: "*",
      });
    }
  };
  const handlePreferencesChange = (
    key: keyof PluginSettings,
    value: boolean | string | number,
  ) => {
    if (state.settings && state.settings[key] === value) {
      // do nothing
    } else {
      postUISettingsChangingMessage(key, value, { targetOrigin: "*" });
    }
  };

  const handleSendToCursor = () => {
    postSendToCursorRequest({ targetOrigin: "*" });
  };

  const darkMode = figmaColorBgValue !== "#ffffff";

  return (
    <div className={`${darkMode ? "dark" : ""}`}>
      <PluginUI
        isLoading={state.isLoading}
        code={state.code}
        warnings={state.warnings}
        selectedFramework={state.selectedFramework}
        setSelectedFramework={handleFrameworkChange}
        onPreferenceChanged={handlePreferencesChange}
        htmlPreview={state.htmlPreview}
        settings={state.settings}
        colors={state.colors}
        gradients={state.gradients}
        onSendToCursor={handleSendToCursor}
      />
    </div>
  );
}
