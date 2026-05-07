// middleware/logger.js

const loggerMiddleware = (req, res, next) => {
  const start = Date.now();

  console.log("\n═══════════════════════════════════════");
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  console.log("🕒", new Date().toISOString());

  // Request Info
  console.log("📦 Body:", req.body);
  console.log("❓ Query:", req.query);
  console.log("🛣 Params:", req.params);
  console.log("🧾 Headers:", {
    authorization: req.headers.authorization,
    "content-type": req.headers["content-type"],
  });

  // Capture response
  const originalSend = res.send;

  res.send = function (body) {
    const duration = Date.now() - start;

    console.log(`📤 Response Status: ${res.statusCode}`);
    console.log("📨 Response Body:", body);
    console.log(`⚡ ${duration}ms`);
    console.log("═══════════════════════════════════════\n");

    return originalSend.call(this, body);
  };

  next();
};

module.exports = loggerMiddleware;