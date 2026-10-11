import streamlit as st
import requests
import pandas as pd
from datetime import datetime
from openai import OpenAI
from bs4 import BeautifulSoup

# Page configuration
st.set_page_config(page_title="Soccer Scout AI", page_icon="⚽", layout="wide")

# App header
st.title("Soccer Scout AI")
st.markdown("Generate professional scouting reports for soccer players using AI")

# Sidebar for API configuration
with st.sidebar:
    st.header("API Configuration")
    api_key = st.text_input("OpenAI API Key", type="password", 
                          help="Enter your OpenAI API key or compatible API key")
    base_url = st.text_input("API Base URL", 
                            value="https://api.openai.com/v1",
                            help="Use default for OpenAI or enter custom endpoint")
    model = st.selectbox("Model", ["gpt-4o", "gpt-4", "gpt-3.5-turbo"])
    
    st.subheader("About")
    st.markdown("""
    This tool scrapes player statistics from FBref.com and uses AI to generate
    professional scouting reports with strengths, weaknesses, and a summary assessment.
    """)

# Main UI for player search
col1, col2 = st.columns([2, 3])

with col1:
    st.subheader("Player Search")
    search_method = st.radio("Search by:", ["Player Name", "FBref URL"])
    
    if search_method == "Player Name":
        player_name = st.text_input("Enter player name:")
        search_button = st.button("Search Player")
        
        if search_button and player_name:
            st.info(f"Searching for {player_name}... (This would typically connect to a search API)")
            # In a complete implementation, this would search FBref for the player
            # For now we'll just provide a sample URL structure
            st.session_state.player_url = f"https://fbref.com/en/search/search_results.html?search={player_name.replace(' ', '+')}"
            st.markdown(f"Visit [FBref search results]({st.session_state.player_url}) to find the player's exact URL")
    else:
        player_url = st.text_input("Enter FBref player URL:", 
                                 placeholder="https://fbref.com/en/players/3423f250/Raphinha")
        if st.button("Generate Report") and player_url:
            if not player_url.startswith("https://fbref.com"):
                st.error("Please enter a valid FBref player URL")
            else:
                with st.spinner("Fetching player data..."):
                    try:
                        # Store the URL in session state
                        st.session_state.player_url = player_url
                        st.session_state.processing = True
                    except Exception as e:
                        st.error(f"Error accessing player page: {e}")

# Function to extract player data
def get_player_data(url):
    try:
        # Get the webpage content
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract player name from the URL or page
        player_name = soup.select_one('h1[itemprop="name"]').text.strip()
        
        # Extract position
        position_element = soup.select_one('p:-soup-contains("Position")')
        position = position_element.text.split(':')[-2].split(' ')[0].strip() if position_element else "Unknown"
        
        # Extract birthday and calculate age
        birthday_element = soup.select_one('span[id="necro-birth"]')
        if birthday_element:
            birthday = birthday_element.text.strip()
            age = (datetime.now() - datetime.strptime(birthday, '%B %d, %Y')).days // 365
        else:
            age = "Unknown"
        
        # Extract team
        team_element = soup.select_one('p:-soup-contains("Club")')
        team = team_element.text.split(':')[-1].strip() if team_element else "Unknown"
        
        # Extract scout data - find the appropriate table
        scout_tables = {}
        for table_id in ['scout_summary_AM', 'scout_summary_FW', 'scout_summary_MF', 'scout_summary_DF']:
            try:
                df = pd.read_html(response.text, attrs={'id': table_id})
                if df:
                    scout_tables[table_id] = df[0]
            except:
                continue
        
        # Select the most appropriate table or the first one if multiple found
        if scout_tables:
            table_id = list(scout_tables.keys())[0]
            df = scout_tables[table_id]
            df = df.dropna(subset='Statistic')
            return {
                'player_name': player_name,
                'position': position,
                'age': age,
                'team': team,
                'stats_df': df,
                'scout_type': table_id
            }
        else:
            return None
            
    except Exception as e:
        st.error(f"Error extracting player data: {e}")
        return None

# Function to generate scouting report
def generate_scouting_report(player_data, api_key, base_url, model):    
    try:
        # Create OpenAI client
        client = OpenAI(
            base_url=base_url,
            api_key=api_key
        )
        
        # Create prompt
        prompt = f"""
        I need you to create a scouting report on {player_data['player_name']}. Can you provide me with a summary of their strengths and weaknesses?

        Here is the data I have on him:

        Player: {player_data['player_name']}
        Position: {player_data['position']}
        Age: {player_data['age']}
        Team: {player_data['team']}

        {player_data['stats_df'].to_markdown()}

        Return the scouting report in the following markdown format:

        # Scouting Report for {player_data['player_name']}

        ## Strengths
        < a list of 1 to 3 strengths >

        ## Weaknesses
        < a list of 1 to 3 weaknesses >

        ## Summary
        < a brief summary of the player's overall performance and if he would be beneficial to the team >
        """
        
        # Generate response from AI
        response = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional football (soccer) scout.",
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model=model,
            temperature=1,
            max_tokens=4096,
            top_p=1
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        st.error(f"Error generating scouting report: {e}")
        return None

# Display processing or results
if hasattr(st.session_state, 'processing') and st.session_state.processing:
    with col2:
        st.subheader("Scouting Report")
        
        with st.spinner("Analyzing player data..."):
            # Get player data
            player_data = get_player_data(st.session_state.player_url)
            
            if player_data:
                # Display player info
                st.write(f"**Player**: {player_data['player_name']}")
                st.write(f"**Position**: {player_data['position']}")
                st.write(f"**Age**: {player_data['age']}")
                st.write(f"**Team**: {player_data['team']}")
                
                # Display stats table
                with st.expander("View Raw Statistics"):
                    st.dataframe(player_data['stats_df'])
                
                # Generate AI report if API key provided
                if api_key:
                    with st.spinner("Generating AI scouting report..."):
                        report = generate_scouting_report(player_data, api_key, base_url, model)
                        if report:
                            st.markdown(report)
                            
                            # Export options
                            if st.button("Export as Markdown"):
                                st.download_button(
                                    label="Download Report",
                                    data=report,
                                    file_name=f"{player_data['player_name']}_report.md",
                                    mime="text/markdown"
                                )
                else:
                    st.warning("Please enter an API key in the sidebar to generate the AI scouting report")
            else:
                st.error("Could not extract player data. Please check the URL and try again.")
            
            # Reset processing flag
            st.session_state.processing = False
else:
    with col2:
        st.info("Enter a player URL and generate a report to see results here")
