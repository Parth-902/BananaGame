import axios from 'axios';

interface BananaResponse {
  question: string;
  solution: number;
}


export class BananaApiService {
  private baseUrl: string = 'https://marcconrad.com/uob/banana/api.php';

  constructor() {}
  
  async getQuestion(): Promise<BananaResponse> {
    try {
      const response = await axios.get(this.baseUrl);
      console.log('Banana API Question Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching question:', error);
      throw error;
    }
  }
} 