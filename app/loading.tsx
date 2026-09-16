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
      <div
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 22,
          fontWeight: 600,
        }}
      >
        Reelezy
      </div>
    </div>
  );
}
