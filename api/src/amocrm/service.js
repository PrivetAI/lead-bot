const axios = require('axios');

class AmoCRMService {
  constructor() {
    this.apiKey = process.env.AMOCRM_API_KEY || 'mock_key_123';
    this.domain = process.env.AMOCRM_DOMAIN || 'mockdomain.amocrm.ru';
    this.baseURL = `https://${this.domain}/api/v4`;
  }

  async getAllLeads() {
    if (this.apiKey === 'mock_key_123') {
      console.log('Mock: Getting all leads from amoCRM');
      return [
        {
          id: 12345,
          name: 'Иван Петров - Консультация',
          phone: '+79161234567',
          email: 'ivan@example.com',
          source: 'website',
          pipeline_id: 1,
          stage_id: 143,
          responsible_user_id: 1,
          created_at: new Date().toISOString()
        },
        {
          id: 12346,
          name: 'Мария Сидорова - Заявка',
          phone: '+79167654321',
          email: 'maria@example.com',
          source: 'telegram',
          pipeline_id: 1,
          stage_id: 142,
          responsible_user_id: 1,
          created_at: new Date().toISOString()
        },
        {
          id: 12347,
          name: 'Алексей Козлов - Повторное обращение',
          phone: '+79169876543',
          email: 'alex@example.com',
          source: 'referral',
          pipeline_id: 1,
          stage_id: 143,
          responsible_user_id: 1,
          created_at: new Date().toISOString()
        }
      ];
    }

    try {
      const response = await axios.get(`${this.baseURL}/leads`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit: 250,
          with: 'contacts'
        }
      });

      return response.data._embedded.leads.map(lead => ({
        id: lead.id,
        name: lead.name,
        phone: this.extractPhone(lead),
        email: this.extractEmail(lead),
        source: this.extractSource(lead),
        pipeline_id: lead.pipeline_id,
        stage_id: lead.status_id,
        responsible_user_id: lead.responsible_user_id,
        created_at: new Date(lead.created_at * 1000).toISOString()
      }));
    } catch (error) {
      console.error('amoCRM API error:', error.message);
      throw error;
    }
  }

  async updateLead(leadId, data) {
    if (this.apiKey === 'mock_key_123') {
      console.log(`Mock: Updating lead ${leadId}:`, data);
      return { success: true, leadId, data };
    }

    try {
      const response = await axios.patch(`${this.baseURL}/leads/${leadId}`, data, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('amoCRM update error:', error.message);
      throw error;
    }
  }

  extractPhone(lead) {
    if (!lead._embedded?.contacts?.[0]?.custom_fields_values) return null;
    
    const phoneField = lead._embedded.contacts[0].custom_fields_values.find(
      field => field.field_code === 'PHONE'
    );
    
    return phoneField?.values?.[0]?.value || null;
  }

  extractEmail(lead) {
    if (!lead._embedded?.contacts?.[0]?.custom_fields_values) return null;
    
    const emailField = lead._embedded.contacts[0].custom_fields_values.find(
      field => field.field_code === 'EMAIL'
    );
    
    return emailField?.values?.[0]?.value || null;
  }

  extractSource(lead) {
    const sourceField = lead.custom_fields_values?.find(
      field => field.field_code === 'UTM_SOURCE'
    );
    
    return sourceField?.values?.[0]?.value || 'unknown';
  }
}

module.exports = AmoCRMService;