import { BananaApiService } from '../services/bananaApi';
import { DatabaseService } from '../services/databaseService';
import { EventService, EventType } from '../services/eventService';


// Interface for game state
interface GameState {
  currentQuestion: string;
  currentSolution: number;
  score: number;
  isPlaying: boolean;
  userId: number | null;
}

export class BananaGame {
  private bananaApi: BananaApiService;
  private dbService: DatabaseService;
  private eventService: EventService;
  private state: GameState;

  constructor(dbService: DatabaseService) {
    // Dependency injection for low coupling
    this.bananaApi = new BananaApiService();
    this.dbService = dbService;
    this.eventService = EventService.getInstance();
    
    this.state = {
      currentQuestion: '',
      currentSolution: 0,
      score: 0,
      isPlaying: false,
      userId: null
    };

    // Set up event listeners
    this.setupEventListeners();
  }

  // Event-driven programming implementation
  private setupEventListeners(): void {
    // Listen for answer submissions and update score
    this.eventService.subscribe(EventType.ANSWER_SUBMITTED, async (payload) => {
      if (payload.isCorrect && this.state.userId) {
        // If this is a new high score, emit an event
        const highScore = await this.dbService.getUserHighScore(this.state.userId);
        if (this.state.score > highScore) {
          this.eventService.publish(EventType.HIGH_SCORE_ACHIEVED, {
            userId: this.state.userId,
            score: this.state.score
          });
        }
      }
    });

    // When game ends, save the score
    this.eventService.subscribe(EventType.GAME_ENDED, async (payload) => {
      if (this.state.userId && this.state.score > 0) {
        try {
          await this.dbService.saveScore(this.state.userId, this.state.score);
          this.eventService.publish(EventType.SCORE_SAVED, {
            userId: this.state.userId,
            score: this.state.score
          });
        } catch (error) {
          console.error('Error saving score:', error);
        }
      }
    });
  }

  // Game logic methods with high cohesion
  public async startGame(userId: number): Promise<void> {
    this.state.isPlaying = true;
    this.state.score = 0;
    this.state.userId = userId;
    
    this.eventService.publish(EventType.GAME_STARTED, {
      userId: this.state.userId
    });
    
    console.log('Game Started:', this.state);
  }

  public async getNewQuestion(): Promise<{ question: string; solution: number }> {
    if (!this.state.isPlaying) {
      throw new Error('Game is not in progress');
    }

    try {
      const response = await this.bananaApi.getQuestion();
      this.state.currentQuestion = response.question;
      this.state.currentSolution = response.solution;
      
      this.eventService.publish(EventType.QUESTION_LOADED, {
        userId: this.state.userId,
        question: this.state.currentQuestion
      });
      
      console.log('New Question State:', {
        question: this.state.currentQuestion,
        solution: this.state.currentSolution
      });
      
      return {
        question: this.state.currentQuestion,
        solution: this.state.currentSolution
      };
    } catch (error) {
      console.error('Error getting new question:', error);
      throw error;
    }
  }

  public async submitAnswer(answer: number): Promise<boolean> {
    if (!this.state.isPlaying) return false;

    try {
      console.log('Checking answer:', answer, 'against solution:', this.state.currentSolution);
      const isCorrect = answer === this.state.currentSolution;
      console.log('Answer result:', { isCorrect, currentScore: this.state.score });
      
      if (isCorrect) {
        this.state.score += 10;
        console.log('Score updated:', this.state.score);
        
        this.eventService.publish(EventType.ANSWER_SUBMITTED, {
          userId: this.state.userId,
          isCorrect: true,
          score: this.state.score
        });
        
        await this.getNewQuestion();
        return true;
      } else {
        this.eventService.publish(EventType.ANSWER_SUBMITTED, {
          userId: this.state.userId,
          isCorrect: false,
          score: this.state.score
        });
        
        return false;
      }
    } catch (error) {
      console.error('Error checking answer:', error);
      throw error;
    }
  }

  public async endGame(): Promise<{ finalScore: number, highScore: number }> {
    this.state.isPlaying = false;
    let highScore = 0;
    
    if (this.state.userId) {
      highScore = await this.dbService.getUserHighScore(this.state.userId);
    }
    
    this.eventService.publish(EventType.GAME_ENDED, {
      userId: this.state.userId,
      finalScore: this.state.score,
      highScore: highScore
    });
    
    console.log('Game Ended:', {
      finalScore: this.state.score,
      highScore: highScore
    });
    
    return {
      finalScore: this.state.score,
      highScore: highScore
    };
  }

  // Getter methods for state
  public getScore(): number {
    return this.state.score;
  }

  public async getHighScore(): Promise<number> {
    if (!this.state.userId) return 0;
    return await this.dbService.getUserHighScore(this.state.userId);
  }

  public isPlaying(): boolean {
    return this.state.isPlaying;
  }
} 