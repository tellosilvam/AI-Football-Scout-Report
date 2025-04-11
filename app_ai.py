import streamlit as st
import requests
import pandas as pd
import os
from datetime import datetime
from bs4 import BeautifulSoup
from openai import OpenAI

# Set page config
st.set_page_config(
    page_title="AI Football Scout",
    page_icon="⚽",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={
        'About': "AI Football Scout - Powered by GPT-4o-mini"
    }
)

# Create API client
@st.cache_resource
def get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        st.error("Missing OpenAI API key. Please set the OPENAI_API_KEY environment variable.")
        st.stop()
    return OpenAI(api_key=api_key)

# Function to scrape player data
def get_player_data(url):
    # Get the webpage content
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Extract player info
    try:
        name = soup.select_one('h1 span').text.strip() if soup.select_one('h1 span') else None
        position_element = soup.select_one('p:-soup-contains("Position:")')
        if position_element:
            text = position_element.get_text()
            position = text.split("Position:")[1].split("▪")[0].strip()
        birthday = soup.select_one('span[id="necro-birth"]').text.strip()
        age = (datetime.now() - datetime.strptime(birthday, '%B %d, %Y')).days // 365
        team = soup.select_one('p:-soup-contains("Club")').text.split(':')[-1].strip()
        
        # Try multiple selectors for player photo
        photo_url = None
        
        # Debug info about images
        all_imgs = soup.find_all('img')
        
        # Try specific selector for headshot
        photo_element = soup.select_one('img[class*="headshot"]')
        if photo_element and 'src' in photo_element.attrs:
            photo_url = photo_element['src']
            # Ensure the URL is absolute
            if not photo_url.startswith('http'):
                photo_url = f"https://fbref.com{photo_url}"
            
        else:
            # Try another approach - look in the media-item div
            media_div = soup.select_one('div.media-item')
            if media_div:
                photo_element = media_div.find('img')
                if photo_element and 'src' in photo_element.attrs:
                    photo_url = photo_element['src']
                    # Ensure the URL is absolute
                    if not photo_url.startswith('http'):
                        photo_url = f"https://fbref.com{photo_url}"
                    
        
        # Find the first table with ID starting with scout_summary_
        table_id = None
        tables = soup.find_all('table')
        for table in tables:
            table_id = table.get('id', '')
            if table_id and table_id.startswith('scout_summary_'):
                break
        
        # If no matching table found, default to a common one
        if not table_id or not table_id.startswith('scout_summary_'):
            table_id = "scout_summary_AM"
        
        df = pd.read_html(response.text, attrs={'id': table_id})[0]
        df = df.dropna(subset='Statistic')
        
        return name, position, age, team, photo_url, df
    
    except Exception as e:
        st.error(f"Error scraping player data: {str(e)}")
        return None, None, None, None, None, None

# Function to generate scouting report
def generate_scouting_report(player_name, position, age, team, stats_df):
    client = get_openai_client()
    
    prompt = f"""
    I need you to create a scouting report on {player_name}. Can you provide me with a summary of their strengths and weaknesses?

    Here is the data I have on him:

    Player: {player_name}
    Position: {position}
    Age: {age}
    Team: {team}

    {stats_df.to_markdown()}


    Return the scouting report in the following markdown format:

    ## {player_name} Scouting Report

    ### Strengths
    < a list of 1 to 3 strengths >

    ### Weaknesses
    < a list of 1 to 3 weaknesses >

    ### Summary
    < a brief summary of the player's overall performance and if he would be beneficial to the team >
    """
    
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
        model="gpt-4o-mini",
        temperature=1,
        max_tokens=4096,
        top_p=1
    )
    
    return response.choices[0].message.content

# Initialize session state for chat
if 'chat_messages' not in st.session_state:
    st.session_state.chat_messages = []

# Adding a key value for chat input reset
if 'chat_input_key' not in st.session_state:
    st.session_state.chat_input_key = 0

# Function to process chat with the scout AI
def process_chat_with_scout_ai(user_question):
    if 'chat_context' not in st.session_state:
        # Create initial context for the conversation
        player_name = st.session_state.name
        position = st.session_state.position
        age = st.session_state.age
        team = st.session_state.team
        stats_df = st.session_state.stats_df
        report = st.session_state.report
        
        # Prepare context from player data and report
        context = f"""
        Player: {player_name}
        Position: {position}
        Age: {age}
        Team: {team}
        
        Statistics:
        {stats_df.to_markdown()}
        
        Scouting Report:
        {report}
        """
        
        # Create system message with context
        system_message = {
            "role": "system", 
            "content": f"You are a professional football (soccer) scout with deep knowledge about players, tactics, and football analytics. Answer questions about the player based on the provided statistics and scouting report. Be concise but insightful. Respond in a conversational tone. Here is the player information:\n\n{context}"
        }
        
        st.session_state.chat_context = [system_message]
    
    # Append user question to context
    st.session_state.chat_context.append({"role": "user", "content": user_question})
    
    # Get response from OpenAI
    client = get_openai_client()
    response = client.chat.completions.create(
        messages=st.session_state.chat_context,
        model="gpt-4o-mini",
        temperature=0.7,
        max_tokens=2048,
        top_p=1
    )
    
    assistant_response = response.choices[0].message.content
    
    # Add assistant response to context for conversation continuity
    st.session_state.chat_context.append({"role": "assistant", "content": assistant_response})
    
    return assistant_response

# Function to reset chat input by incrementing the key
def reset_chat_input():
    st.session_state.chat_input_key += 1

# Interface
st.title("⚽ AI Football (Soccer) Scout Report")
st.markdown("Generate professional scouting reports using AI and player statistics from FBRef.")

# Create tabs for the main sections
tab1, tab2 = st.tabs(["📊 Scouting Report", "💬 Chat with Scout AI"])

with tab1:
    col1, col2 = st.columns([1, 2])

    def generate_report(get_player_data, generate_scouting_report, player_url):
        # Check if we already have a report for this URL
        if 'current_url' in st.session_state and st.session_state.current_url == player_url:
            return
            
        with st.spinner("Fetching player data..."):
            name, position, age, team, photo_url, stats_df = get_player_data(player_url)
                            
            if stats_df is not None:
                st.session_state.name = name
                st.session_state.position = position
                st.session_state.age = age
                st.session_state.team = team
                st.session_state.stats_df = stats_df
                st.session_state.photo_url = photo_url
                st.session_state.current_url = player_url
                                
                # Generate report
                with st.spinner("Generating scouting report..."):
                    report = generate_scouting_report(name, position, age, team, stats_df)
                    st.session_state.report = report
                    
                # Reset chat when a new player is loaded
                st.session_state.chat_messages = []
                if 'chat_context' in st.session_state:
                    del st.session_state.chat_context
                                
                st.success("Report generated!")

                # Switch to scouting report tab
                st.rerun()
            else:
                st.error("Failed to fetch player data. Check the URL and try again.")

    with col1:
        st.subheader("Player Information")
        
        input_method = st.radio("Choose input method:", ["Player Name", "FBRef URL"])
        
        if input_method == "Player Name":
            player_name = st.text_input("Enter player full name (First and Last name)")
            if player_name:
                st.info(f"Looking up {player_name}...")
                # Search for player on FBRef
                search_url = f"https://fbref.com/search/search.fcgi?search={player_name.replace(' ', '+')}"
                try:
                    response = requests.get(search_url)
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Find the first player link in the search results
                    player_link = soup.select_one('a[href*="/en/players/"]')
                    if player_link:
                        player_url = f"{player_link['href']}"
                        st.success(f"Player found: {player_name}. Using URL: {player_url}")
                        
                        # Automatically populate the URL input field
                        st.session_state.player_url = player_url

                        # Generate report automatically when player is found
                        generate_report(get_player_data, generate_scouting_report, player_url)

                    else:
                        st.error("Player not found. Please refine your search.")
                except Exception as e:
                    st.error(f"Error searching for player: {str(e)}")
        else:
            player_url = st.text_input("Enter FBRef player URL", 
                                    "https://fbref.com/en/players/3423f250/Raphinha")
            
        if st.button("Generate Report", type="primary"):
            if input_method == "FBRef URL" and player_url:
                generate_report(get_player_data, generate_scouting_report, player_url)
            else:
                st.error("Please enter a valid FBRef URL")

    # Display report if it exists
    with col2:
        if 'report' in st.session_state:
            # Display photo and player details side by side
            if 'photo_url' in st.session_state:
                col2_1, col2_2 = st.columns([1, 3])
                
                with col2_1:
                    if st.session_state.photo_url:
                        try:
                            st.image(st.session_state.photo_url, width=120)
                        except Exception as e:
                            st.warning(f"Error displaying image: {str(e)}")
                
                with col2_2:
                    st.markdown(f"""
                    **Position:** {st.session_state.position}\n
                    **Age:** {st.session_state.age}\n
                    **Team:** {st.session_state.team}
                    """)
            
            st.markdown(st.session_state.report)
            
            # Add download button
            st.download_button(
                label="Download Report",
                data=st.session_state.report,
                file_name=f"{st.session_state.name}_report.md",
                mime="text/markdown"
            )
            
            # Display the raw data
            with st.expander("View Player Statistics"):
                st.dataframe(st.session_state.stats_df.set_index('Statistic'), use_container_width=True)

# Chat Interface tab
with tab2:
    if 'report' not in st.session_state:
        st.info("👈 Please generate a scouting report first to chat with the AI Scout")
    else:
        st.subheader(f"💬 Chat with AI Scout about {st.session_state.name}")
        
        # Chat interface styling
        st.markdown("""
        <style>
        .chat-message {
            padding: 0.75rem;
            border-radius: 0.5rem;
            margin-bottom: 0.5rem;
            display: flex;
            flex-direction: column;
        }
        /* Dark mode styles */
        [data-theme="dark"] .chat-message.user {
            background-color: #26272F;
        }
        [data-theme="dark"] .chat-message.assistant {
            background-color: #101010;
        }
        /* Light mode styles */
        [data-theme="light"] .chat-message.user {
            background-color: #E9EBF1;
        }
        [data-theme="light"] .chat-message.assistant {
            background-color: #FFFFFF;
        }
        .chat-message .avatar {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            object-fit: cover;
            margin-right: 10px;
        }
        .chat-message .message {
            padding: 0.5rem 0;
        }
        .chat-message .name {
            font-weight: bold;
            font-size: 0.8rem;
            color: #888;
            margin-bottom: 0.5rem;
        }
        .stContainer {
            margin-top: 0;
            padding-top: 0;
        }
        </style>
        """, unsafe_allow_html=True)
        
        # Initial message from assistant
        if not st.session_state.chat_messages:
            initial_message = f"Hi! I'm your AI football scout. I've analyzed {st.session_state.name}'s stats and created the scouting report. What would you like to know about this player?"
            st.session_state.chat_messages.append({"role": "assistant", "content": initial_message})
            
            # Initialize chat context
            if 'chat_context' not in st.session_state:
                player_name = st.session_state.name
                position = st.session_state.position
                age = st.session_state.age
                team = st.session_state.team
                stats_df = st.session_state.stats_df
                report = st.session_state.report
                
                # Prepare context from player data and report
                context = f"""
                Player: {player_name}
                Position: {position}
                Age: {age}
                Team: {team}
                
                Statistics:
                {stats_df.to_markdown()}
                
                Scouting Report:
                {report}
                """
                
                # Create system message with context
                system_message = {
                    "role": "system", 
                    "content": f"You are a professional football (soccer) scout with deep knowledge about players, tactics, and football analytics. Answer questions about the player based on the provided statistics and scouting report. Be concise but insightful. Respond in a conversational tone. Here is the player information:\n\n{context}"
                }
                
                st.session_state.chat_context = [system_message]
                st.session_state.chat_context.append({"role": "assistant", "content": initial_message})

        # Chat container with fixed height and scrolling
        chat_container = st.container()
        with chat_container:
            # Create a more compact chat interface
            for message in st.session_state.chat_messages:
                if message["role"] == "user":
                    st.markdown(f"""
                    <div class="chat-message user">
                        <div class="name">You</div>
                        <div class="message">{message['content']}</div>
                    </div>
                    """, unsafe_allow_html=True)
                else:
                    st.markdown(f"""
                    <div class="chat-message assistant">
                        <div class="name">AI Scout</div>
                        <div class="message">{message['content']}</div>
                    </div>
                    """, unsafe_allow_html=True)
            
            # Close the scrollable container
            st.markdown('</div>', unsafe_allow_html=True)
        
        # Chat input
        with st.container():
            col1, col2 = st.columns([6, 1])
            with col1:
                # Use a dynamic key for the text input to force a reset
                user_question = st.text_input(
                    "", 
                    placeholder="Ask a question about the player...", 
                    key=f"chat_input_{st.session_state.chat_input_key}", label_visibility="collapsed"
                )
            with col2:
                send_button = st.button("Send", use_container_width=True, key="send_chat")
            
            if send_button and user_question:
                # Add user question to chat history
                st.session_state.chat_messages.append({"role": "user", "content": user_question})
                
                # Show typing indicator
                typing_placeholder = st.empty()
                typing_placeholder.markdown("""
                <div class="chat-message assistant">
                    <div class="name">AI Scout</div>
                    <div class="message">Thinking...</div>
                </div>
                """, unsafe_allow_html=True)
                
                # Generate AI response
                ai_response = process_chat_with_scout_ai(user_question)
                
                # Remove typing indicator
                typing_placeholder.empty()
                
                # Add AI response to chat history
                st.session_state.chat_messages.append({"role": "assistant", "content": ai_response})
                
                # Reset the chat input by incrementing the key
                reset_chat_input()
                
                # Rerun to display updated chat
                st.rerun()
            
        # Suggested questions
        if len(st.session_state.chat_messages) < 3:
            st.markdown("### Suggested questions")
            suggested_questions = [
                f"What are {st.session_state.name}'s top 3 strongest attributes based on the statistics?",
                f"How would {st.session_state.name}'s playing style complement a high-pressing system?",
                f"Can you analyze {st.session_state.name}'s set-piece contribution and aerial ability?",
                f"What specific technical aspects should {st.session_state.name} focus on improving?",
                f"How does {st.session_state.name}'s performance metrics compare to the league's top 5 players?",
                f"Given {st.session_state.name}'s age and current level, what's their potential for the next seasons?"
            ]
            
            col1, col2 = st.columns(2)
            with col1:
                for q in suggested_questions[:3]:
                    if st.button(q, key=f"q_{q[:20]}", use_container_width=True):
                        # Add user question to chat history
                        st.session_state.chat_messages.append({"role": "user", "content": q})
                        
                        # Generate AI response
                        ai_response = process_chat_with_scout_ai(q)
                        
                        # Add AI response to chat history
                        st.session_state.chat_messages.append({"role": "assistant", "content": ai_response})
                        
                        # Rerun to display updated chat
                        st.rerun()
            
            with col2:
                for q in suggested_questions[3:]:
                    if st.button(q, key=f"q_{q[:20]}", use_container_width=True):
                        # Add user question to chat history
                        st.session_state.chat_messages.append({"role": "user", "content": q})
                        
                        # Generate AI response
                        ai_response = process_chat_with_scout_ai(q)
                        
                        # Add AI response to chat history
                        st.session_state.chat_messages.append({"role": "assistant", "content": ai_response})
                        
                        # Rerun to display updated chat
                        st.rerun()

# Footer
st.markdown("---")
st.caption("Data source: FBRef.com | AI powered by GPT-4o-mini")
