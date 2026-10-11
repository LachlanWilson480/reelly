import { ReelezyLogo } from '@/components/ReelezyLogo'
export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}><ReelezyLogo size={44} /></div>
    </div>
  );
}
