import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DatabaseService, User } from './databaseService';

// This should be stored in environment variables
const JWT_SECRET = 'banana-game-secret-key';

export interface TokenPayload {
  userId: number;
  username: string;
}

export class AuthService {
  private dbService: DatabaseService;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
  }

  async registerUser(username: string, password: string): Promise<{ token: string, userId: number } | null> {
    // First check if user exists
    const existingUser = await this.dbService.getUserByUsername(username);
    if (existingUser) {
      return null; // User already exists
    }

    // Create new user
    const user = await this.dbService.createUser(username, password);
    if (!user || !user.id) {
      return null;
    }

    // Generate token
    const token = this.generateToken(user);
    return { 
      token,
      userId: user.id 
    };
  }

  async loginUser(username: string, password: string): Promise<{ token: string, userId: number } | null> {
    const user = await this.dbService.validateUser(username, password);
    if (!user || !user.id) {
      return null;
    }

    // Generate token
    const token = this.generateToken(user);
    return { token, userId: user.id };
  }

  generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id as number,
      username: user.username
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      return null;
    }
  }

  // Express middleware to authenticate requests
  authenticate(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = this.verifyToken(token);

    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Add user information to request object
    (req as any).user = payload;
    next();
  }
} 