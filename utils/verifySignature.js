const crypto = require("crypto");

const verifyRazorpaySignature = (orderId, paymentId, signature, secret) => {
  const text = orderId + "|" + paymentId;
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(text)
    .digest("hex");

  return generatedSignature === signature;
};

const verifyWebhookSignature = (body, signature, secret) => {
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");

  return generatedSignature === signature;
};

module.exports = {
  verifyRazorpaySignature,
  verifyWebhookSignature,
};
