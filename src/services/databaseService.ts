import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import bcrypt from 'bcrypt';

export interface User {
  id?: number;
  username: string;
  password: string;
}

export interface Score {
  id?: number;
  userId: number;
  score: number;
  timestamp: string;
}

export class DatabaseService {
  private db: Database | null = null;

  async initialize(): Promise<void> {
    // Open database
    this.db = await open({
      filename: './game_database.sqlite',
      driver: sqlite3.Database
    });

    // Create tables if they don't exist
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        score INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users (id)
      );
    `);
  }

  // User management methods
  async createUser(username: string, password: string): Promise<User | null> {
    if (!this.db) await this.initialize();

    try {
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insert the user into the database
      const result = await this.db!.run(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hashedPassword]
      );

      if (result.lastID) {
        return {
          id: result.lastID,
          username,
          password: hashedPassword
        };
      }
      return null;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    if (!this.db) await this.initialize();

    try {
      const user = await this.db!.get<User>(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      return user || null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    return valid ? user : null;
  }

  // Score management methods
  async saveScore(userId: number, score: number): Promise<void> {
    if (!this.db) await this.initialize();

    try {
      const timestamp = new Date().toISOString();
      await this.db!.run(
        'INSERT INTO scores (userId, score, timestamp) VALUES (?, ?, ?)',
        [userId, score, timestamp]
      );
    } catch (error) {
      console.error('Error saving score:', error);
      throw error;
    }
  }

  async getHighScores(limit: number = 10): Promise<{username: string, score: number}[]> {
    if (!this.db) await this.initialize();

    try {
      return await this.db!.all(`
        SELECT users.username, MAX(scores.score) as score
        FROM scores
        JOIN users ON users.id = scores.userId
        GROUP BY users.id
        ORDER BY score DESC
        LIMIT ?
      `, [limit]);
    } catch (error) {
      console.error('Error fetching high scores:', error);
      return [];
    }
  }

  async getUserHighScore(userId: number): Promise<number> {
    if (!this.db) await this.initialize();

    try {
      const result = await this.db!.get(
        'SELECT MAX(score) as highScore FROM scores WHERE userId = ?',
        [userId]
      );
      return result?.highScore || 0;
    } catch (error) {
      console.error('Error fetching user high score:', error);
      return 0;
    }
  }
} 