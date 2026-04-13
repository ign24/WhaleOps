import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"],
  },
  {
    // @floating-ui/react uses callback refs (setter functions, not .current access).
    // The react-hooks/refs rule incorrectly flags these as "reading ref during render".
    files: ["components/ui/tooltip.tsx"],
    rules: {
      "react-hooks/refs": "off",
    },
  },
];

export default eslintConfig;
