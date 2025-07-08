# Color Prediction Game Server

A real-time color prediction game server with real money betting, Razorpay payment integration, and Socket.IO for live updates.

## Features

- 🎮 Real-time color prediction game
- 💰 Real money betting with Razorpay integration
- 🔐 User authentication with OTP verification
- 💳 Wallet management with deposits and withdrawals
- 📊 Comprehensive transaction tracking
- 🎯 Real-time game updates via Socket.IO
- 👨‍💼 Admin panel for game management
- 📈 Detailed statistics and analytics

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.IO
- **Payment**: Razorpay
- **Authentication**: Session-based (no JWT)
- **Security**: Helmet, Rate Limiting, CORS

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Razorpay account
- Gmail account for OTP

## Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/color-prediction-game

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Razorpay Configuration
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd color-prediction-server
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication

#### Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "verified": true
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Game Management

#### Get Current Round (Public)
```http
GET /api/game/current-round
```

#### Get Recent Rounds (Public)
```http
GET /api/game/recent-rounds?limit=10
```

#### Place Bet (Authenticated)
```http
POST /api/game/place-bet
User-Id: <user-id>
Content-Type: application/json

{
  "roundId": "round-id",
  "chosenColor": "red",
  "amount": 100
}
```

#### Get Bet History (Authenticated)
```http
GET /api/game/bet-history?page=1&limit=10
User-Id: <user-id>
```

#### Create Round (Admin Only)
```http
POST /api/game/create-round
User-Id: <admin-user-id>
Content-Type: application/json

{
  "duration": 60
}
```

### Payment Management

#### Create Deposit Order
```http
POST /api/payment/create-deposit-order
User-Id: <user-id>
Content-Type: application/json

{
  "amount": 1000
}
```

#### Verify Deposit Payment
```http
POST /api/payment/verify-deposit-payment
User-Id: <user-id>
Content-Type: application/json

{
  "razorpay_order_id": "order_id",
  "razorpay_payment_id": "payment_id",
  "razorpay_signature": "signature"
}
```

#### Create Withdrawal Request
```http
POST /api/payment/create-withdrawal-request
User-Id: <user-id>
Content-Type: application/json

{
  "amount": 500,
  "bankDetails": {
    "accountHolderName": "John Doe",
    "accountNumber": "1234567890",
    "ifsc": "SBIN0001234"
  }
}
```

#### Get Transaction History
```http
GET /api/payment/transaction-history?page=1&limit=10&type=deposit
User-Id: <user-id>
```

### Wallet Management

#### Get Wallet Balance
```http
GET /api/wallet/balance
User-Id: <user-id>
```

#### Get Wallet Statistics
```http
GET /api/wallet/stats?period=30
User-Id: <user-id>
```

#### Get Recent Transactions
```http
GET /api/wallet/recent-transactions?limit=5
User-Id: <user-id>
```

### Admin Endpoints

#### Get All Transactions (Admin)
```http
GET /api/transaction/all?page=1&limit=20&type=deposit&status=completed
User-Id: <admin-user-id>
```

#### Get Transaction Statistics (Admin)
```http
GET /api/transaction/stats?period=30
User-Id: <admin-user-id>
```

#### Update Transaction Status (Admin)
```http
PATCH /api/transaction/:transactionId/status
User-Id: <admin-user-id>
Content-Type: application/json

{
  "status": "completed",
  "notes": "Payment verified"
}
```

#### Refund Transaction (Admin)
```http
POST /api/transaction/:transactionId/refund
User-Id: <admin-user-id>
Content-Type: application/json

{
  "reason": "Customer request"
}
```

## Socket.IO Events

### Client to Server

#### Join User Room
```javascript
socket.emit('join:user', { userId: 'user-id' });
```

#### Get Current Round
```javascript
socket.emit('get:current-round');
```

#### Get Recent Rounds
```javascript
socket.emit('get:recent-rounds', { limit: 10 });
```

#### Place Bet
```javascript
socket.emit('place:bet', {
  userId: 'user-id',
  roundId: 'round-id',
  chosenColor: 'red',
  amount: 100
});
```

#### Get Bet History
```javascript
socket.emit('get:bet-history', {
  userId: 'user-id',
  page: 1,
  limit: 10
});
```

#### Get Wallet Balance
```javascript
socket.emit('get:wallet-balance', { userId: 'user-id' });
```

### Server to Client

#### Round Updates
```javascript
socket.on('round:update', (data) => {
  console.log('Round updated:', data);
});

socket.on('round:time-update', (data) => {
  console.log('Time left:', data.timeLeft);
});

socket.on('round:result', (data) => {
  console.log('Round result:', data.resultColor);
});
```

#### Bet Updates
```javascript
socket.on('bet:update', (data) => {
  console.log('New bet placed:', data);
});

socket.on('bet:placed', (data) => {
  console.log('Your bet placed:', data);
});
```

#### User Data
```javascript
socket.on('current:round', (data) => {
  console.log('Current round:', data.round);
});

socket.on('recent:rounds', (data) => {
  console.log('Recent rounds:', data.rounds);
});

socket.on('bet:history', (data) => {
  console.log('Bet history:', data.bets);
});

socket.on('wallet:balance', (data) => {
  console.log('Wallet balance:', data.wallet);
});
```

#### Error Handling
```javascript
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
});
```

## Authentication

This API uses session-based authentication without JWT. Users are identified by their User ID in request headers:

```javascript
// Include User-Id in headers for authenticated requests
const headers = {
  'Content-Type': 'application/json',
  'User-Id': 'user-id-here'
};
```

## Database Models

### User
- Email, password, role
- Wallet balance, game statistics
- Online status, socket ID
- Bank details, KYC status

### GameRound
- Round ID, start/end times
- Status (pending/active/completed)
- Result color, total pool
- Commission, result seed

### Bet
- User ID, game round ID
- Chosen color, amount
- Winner status, payout amount
- Payment IDs, status

### Transaction
- User ID, type, amount
- Razorpay payment details
- Balance before/after
- Status, metadata

### Wallet
- User ID, balance
- Locked balance, totals
- Currency, activity tracking

## Game Flow

1. **Admin creates a round** - Round starts in "pending" status
2. **Round becomes active** - Users can place bets
3. **Round ends** - Result is generated, payouts processed
4. **New round starts** - Cycle repeats

## Payment Flow

1. **User creates deposit order** - Razorpay order created
2. **User completes payment** - Payment verified via webhook
3. **Wallet credited** - User can start betting
4. **Withdrawal request** - Admin processes manually

## Security Features

- Rate limiting (100 requests per 15 minutes)
- Helmet security headers
- CORS protection
- Input validation
- SQL injection protection (MongoDB)
- XSS protection

## Error Handling

All endpoints return consistent error responses:

```json
{
  "message": "Error description",
  "errors": ["field1 error", "field2 error"] // for validation errors
}
```

## Health Check

```http
GET /health
```

Returns server status and timestamp.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests (when implemented)
npm test
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure MongoDB connection
3. Set up Razorpay webhooks
4. Configure email service
5. Set up proper CORS origins
6. Use PM2 or similar process manager

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License. 