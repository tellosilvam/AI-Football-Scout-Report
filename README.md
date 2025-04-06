# 🤖⚽ AI Football Scout Report

[![Streamlit](https://img.shields.io/badge/Streamlit-App-red?logo=streamlit)](https://ai-football-scout-report.streamlit.app/)
[![Python](https://img.shields.io/badge/Python-3.x-blue?logo=python)](https://github.com/tellosilvam/AI-Football-Scout-Report/blob/main/app_ai.py)
![Pandas](https://img.shields.io/badge/Pandas-Data%20Analysis-yellow?logo=pandas)
![BeautifulSoup](https://img.shields.io/badge/BeautifulSoup-Web%20Scraping-green?logo=beautifulsoup)
![OpenAI](https://img.shields.io/badge/Chat-GPT-4B00E0?logo=openai)

![AI Football Scout](thumb.png)

---

## 🌐 Live App

🎮 [**Launch the App**](https://ai-football-scout-report.streamlit.app/)  
📁 [**GitHub Repository**](https://github.com/tellosilvam/AI-Football-Scout-Report)

---

## 📌 Project Overview

The **AI Football Scout Report** is a Streamlit-based web application that allows users to generate **AI-powered scouting reports** on any football player available on [FBref.com](https://fbref.com). Powered by GPT and real-time data scraping, this tool is ideal for football analysts, and professional scouts looking for quick insights on a player’s performance.

---

## ✨ Key Features

### 🔍 1. Player Input
- You can **type the player's first and last name**, or  
- Paste the **direct URL** to the player’s [FBref](https://fbref.com) profile page.

### 🧠 2. AI-Generated Scouting Report
- The app **scrapes the player's scouting stats** from FBref.
- It then sends this data to **GPT-4o**, which returns a **natural-language scouting report** mimicking a real football scout’s tone.

### 💬 3. AI Chatbot Agent
- After reading the report, users can ask follow-up questions about the player.
- The **AI chatbot acts as a professional scout**, answering based on the scraped stats and past insights.

---

## ⚙️ How It Works

1. **User enters player name or FBref URL**  
2. **App scrapes scouting stats** using BeautifulSoup  
3. **Stats are sent to GPT-4o** via OpenAI API  
4. **A detailed scouting report is returned**  
5. **User chats with a scout-like agent**, powered by the same data  

---

## 🛠️ Tech Stack

| Tool / Library         | Purpose                                  |
|------------------------|------------------------------------------|
| **Python** 🐍            | Core programming language                |
| **Streamlit** 🎨         | Web app framework                        |
| **Pandas** 📊            | Data handling and cleaning               |
| **BeautifulSoup** 🌐    | Web scraping from FBref                  |
| **OpenAI (GPT-4)** 🤖    | AI-powered report and chatbot agent      |

---

## 🚀 Run Locally

1️⃣ **Clone the Repository**
```bash
git clone https://github.com/tellosilvam/AI-Football-Scout-Report.git

> 📌 **Note:** Don't forget to use your own Open AI API key.

cd AI-Football-Scout-Report
