# Logistics Control Tower v2.5

Advanced vessel tracking and maritime logistics management system with real-time simulation, weather integration, and AI-powered analytics.

## Features

- **Interactive Vessel Tracking**: Real-time vessel position tracking with Leaflet.js maps
- **Voyage Schedule Management**: Complete ETD/ETA tracking with Go/No-Go decision support
- **Weather Integration**: CSV weather data upload with automatic schedule adjustments
- **AI-Powered Analytics**: Daily briefings and risk assessment with AI assistant
- **Real-time Simulation**: Configurable speed simulation with marine data integration
- **IOI Calculation**: Index of Interest scoring based on wave height, wind speed, and swell period
- **Accessibility**: Full ARIA support, keyboard navigation, and screen reader compatibility

## Technology Stack

- **Frontend**: HTML5, JavaScript ES6+, Tailwind CSS
- **Mapping**: Leaflet.js with dark theme tiles
- **Weather Data**: Open-Meteo Marine API integration
- **Performance**: Web Workers for marine data processing
- **Deployment**: Static export optimized for Vercel

## Quick Start

1. **Deploy to Vercel**: Click the "Publish" button in the top right
2. **Access the Application**: Navigate to `/logistics-app.html` 
3. **Upload Data**: Use the upload buttons to load voyage schedules (CSV/JSON) and weather data (CSV)
4. **Monitor Operations**: Watch real-time vessel tracking and schedule updates

## File Formats

### Schedule Data (CSV/JSON)
\`\`\`csv
id,cargo,etd,eta,status
69th,Dune Sand,2025-09-28T16:00:00Z,2025-09-29T04:00:00Z,Scheduled
\`\`\`

### Weather Data (CSV)
\`\`\`csv
start,end,wave_m,wind_kt,vis_km
2025-09-28T12:00:00Z,2025-09-28T18:00:00Z,1.5,20,5.0
\`\`\`

## Key Components

- **Vessel Control Panel**: Real-time vessel status and marine conditions
- **Schedule Table**: Full voyage schedule with IOI scoring and Go/No-Go decisions  
- **Risk Simulation**: Time-accelerated simulation with weather-based risk assessment
- **AI Assistant**: Interactive chat for logistics queries and analysis
- **Weather Linkage**: Automatic schedule adjustments based on weather windows

## Accessibility Features

- Screen reader support with comprehensive ARIA labels
- Keyboard navigation for all interactive elements
- High contrast mode support
- Focus management for modal dialogs
- Skip links for keyboard users

## Performance Optimizations

- Web Workers for marine data processing
- Passive event listeners for scroll/touch
- RequestIdleCallback for non-critical operations
- Optimized rendering with minimal DOM updates

Built with ❤️ for maritime logistics professionals.
\`\`\`

```json file="" isHidden
