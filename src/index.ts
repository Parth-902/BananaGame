import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { BananaGame } from './game/BananaGame';
import { DatabaseService } from './services/databaseService';
import { AuthService } from './services/authService';
import { EventService, EventType } from './services/eventService';

const app = express();
const port = process.env.PORT || 3000;

// Initialize services
const dbService = new DatabaseService();
const authService = new AuthService(dbService);
const eventService = EventService.getInstance();

// Initialize game
const game = new BananaGame(dbService);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(cookieParser());

// Initialize database
(async () => {
  await dbService.initialize();
  console.log('Database initialized');
})();

// Authentication middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip authentication for public routes
  const publicRoutes = ['/', '/api/auth/register', '/api/auth/login'];
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  // Get token from header or cookie
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1]
    : req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const payload = authService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  // Add user data to request
  (req as any).user = payload;
  next();
};

app.use(authenticate);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Username and password are required'
    });
  }
  
  try {
    const result = await authService.registerUser(username, password);
    
    if (!result) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username already exists'
      });
    }
    
    // Set token as cookie
    res.cookie('token', result.token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    // Emit event for user registration
    eventService.publish(EventType.USER_REGISTERED, { username });
    
    res.json({ 
      success: true,
      token: result.token,
      userId: result.userId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to register user'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Username and password are required'
    });
  }
  
  try {
    const result = await authService.loginUser(username, password);
    
    if (!result) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password'
      });
    }
    
    // Set token as cookie
    res.cookie('token', result.token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    // Emit event for user login
    eventService.publish(EventType.USER_LOGGED_IN, { username });
    
    res.json({ 
      success: true,
      token: result.token,
      userId: result.userId
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to login'
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Game API endpoints
app.post('/api/game/start', async (req, res) => {
  const userId = (req as any).user.userId;
  await game.startGame(userId);
  res.json({ success: true });
});

app.post('/api/game/question', async (req, res) => {
  try {
    const questionData = await game.getNewQuestion();
    res.json({ 
      success: true,
      question: questionData.question
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch question'
    });
  }
});

app.post('/api/game/answer', async (req, res) => {
  const { answer } = req.body;
  if (typeof answer !== 'number') {
    return res.status(400).json({ error: 'Answer must be a number' });
  }
  try {
    const isCorrect = await game.submitAnswer(answer);
    res.json({ 
      success: true,
      isCorrect,
      score: game.getScore()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to check answer'
    });
  }
});

app.post('/api/game/end', async (req, res) => {
  const result = await game.endGame();
  res.json({ 
    success: true,
    finalScore: result.finalScore,
    highScore: result.highScore
  });
});

// Leaderboard endpoint
app.get('/api/leaderboard', async (req, res) => {
  try {
    const highScores = await dbService.getHighScores();
    res.json({
      success: true,
      highScores
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

// User high score endpoint
app.get('/api/user/highscore', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const highScore = await dbService.getUserHighScore(userId);
    
    res.json({
      success: true,
      highScore
    });
  } catch (error) {
    console.error('Error fetching user high score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch high score'
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 