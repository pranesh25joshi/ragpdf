import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentUploads, setRecentUploads] = useState([]);
  const [collectionName, setCollectionName] = useState('ragpdf');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load recent uploads from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentUploads');
    if (stored) {
      setRecentUploads(JSON.parse(stored));
    }
  }, []);

  const saveToRecentUploads = (file) => {
    const newUpload = {
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2),
      timestamp: new Date().toISOString()
    };
    const updated = [newUpload, ...recentUploads.slice(0, 4)];
    setRecentUploads(updated);
    localStorage.setItem('recentUploads', JSON.stringify(updated));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PDF file');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setUploadStatus('uploading');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const { job_id } = response.data;
      setJobId(job_id);
      setUploadStatus('processing');
      saveToRecentUploads(file);

      // Poll for job status
      pollJobStatus(job_id);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
    }
  };

  const pollJobStatus = async (jobId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/job-status`, {
          params: { job_id: jobId }
        });

        const { status, result } = response.data;

        if (status === 'finished') {
          clearInterval(pollInterval);
          setUploadStatus('ready');
          setCollectionName(result.collection_name || 'ragpdf');
        } else if (status === 'failed') {
          clearInterval(pollInterval);
          setUploadStatus('error');
          console.error('Job failed:', result);
        }
      } catch (error) {
        clearInterval(pollInterval);
        setUploadStatus('error');
        console.error('Status check error:', error);
      }
    }, 2000);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || uploadStatus !== 'ready') return;

    const userMessage = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/chat`,
        null,
        {
          params: {
            query: inputMessage,
            collection_name: collectionName,
            top_k: 15
          },
          responseType: 'stream',
          adapter: 'fetch'
        }
      );

      const reader = response.data.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantMessage.content += chunk;
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { ...assistantMessage };
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, there was an error processing your request.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white h-screen w-full flex overflow-hidden selection:bg-primary selection:text-black">
      <main className="flex flex-1 h-full overflow-hidden relative">
        {/* Left Panel - Upload Section */}
        <div className="flex-1 h-full p-6 md:p-8 flex flex-col relative border-r border-gray-200 dark:border-border-dark bg-slate-50 dark:bg-[#0c1610]">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 flex-none">
            <div className="bg-primary/20 p-2 rounded-lg">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '28px' }}>
                smart_toy
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight dark:text-white">PDF Chat</h1>
              <p className="text-xs text-slate-500 dark:text-[#9db9a6] font-medium">AI Assistant</p>
            </div>
          </div>

          {/* Upload Area */}
          <div className="flex-1 flex flex-col justify-center items-center w-full">
            <div className="w-full max-w-lg">
              <div
                className={`group relative flex flex-col items-center justify-center w-full h-[400px] rounded-[3rem] border-2 border-dashed ${
                  isDragging 
                    ? 'border-primary bg-primary/10' 
                    : 'border-slate-300 dark:border-[#3b5443] hover:border-primary dark:hover:border-primary bg-white dark:bg-[#111813]'
                } transition-all duration-300 ease-out hover:bg-primary/5 cursor-pointer`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <div className="flex flex-col items-center gap-6 p-6 text-center z-10">
                  {uploadStatus === 'uploading' || uploadStatus === 'processing' ? (
                    <>
                      <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '40px' }}>
                          sync
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                          {uploadStatus === 'uploading' ? 'Uploading...' : 'Processing document...'}
                        </h2>
                        <p className="text-slate-500 dark:text-[#9db9a6] text-sm">
                          {selectedFile?.name}
                        </p>
                      </div>
                    </>
                  ) : uploadStatus === 'ready' ? (
                    <>
                      <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-green-500" style={{ fontSize: '40px' }}>
                          check_circle
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400">
                          Document ready!
                        </h2>
                        <p className="text-slate-500 dark:text-[#9db9a6] text-sm">
                          {selectedFile?.name}
                        </p>
                      </div>
                      <button className="mt-4 px-8 py-3 bg-slate-900 dark:bg-[#28392e] hover:bg-primary dark:hover:bg-primary text-white hover:text-black dark:hover:text-black font-bold rounded-full transition-all duration-200 shadow-lg hover:shadow-primary/25 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">upload_file</span>
                        Upload another
                      </button>
                    </>
                  ) : uploadStatus === 'error' ? (
                    <>
                      <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-red-500" style={{ fontSize: '40px' }}>
                          error
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
                          Upload failed
                        </h2>
                        <p className="text-slate-500 dark:text-[#9db9a6] text-sm">
                          Please try again
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-[#1a261e] flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <span className="material-symbols-outlined text-slate-400 dark:text-[#5c7a66] group-hover:text-primary transition-colors" style={{ fontSize: '40px' }}>
                          cloud_upload
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                          Drop your PDF here
                        </h2>
                        <p className="text-slate-500 dark:text-[#9db9a6] text-sm">
                          Supports .pdf, .txt up to 10MB
                        </p>
                      </div>
                      <button className="mt-4 px-8 py-3 bg-slate-900 dark:bg-[#28392e] hover:bg-primary dark:hover:bg-primary text-white hover:text-black dark:hover:text-black font-bold rounded-full transition-all duration-200 shadow-lg hover:shadow-primary/25 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">folder</span>
                        Browse files
                      </button>
                    </>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50/50 dark:to-white/5 rounded-[3rem] pointer-events-none"></div>
              </div>
            </div>

            {/* Recent Uploads */}
            {recentUploads.length > 0 && (
              <div className="mt-8 w-full max-w-lg">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#5c7a66] mb-4 pl-4">
                  Recent Uploads
                </h3>
                <div className="flex flex-col gap-2">
                  {recentUploads.map((upload, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#111813] border border-gray-100 dark:border-transparent hover:border-primary/30 dark:hover:border-primary/30 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-500">
                          <span className="material-symbols-outlined text-[20px]">
                            {upload.name.endsWith('.pdf') ? 'picture_as_pdf' : 'description'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium dark:text-gray-200">{upload.name}</span>
                          <span className="text-xs text-slate-400 dark:text-gray-500">
                            {upload.size} MB • {getTimeAgo(upload.timestamp)}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 group-hover:text-primary text-[20px]">
                        arrow_forward
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat Section */}
        <div className="flex-1 h-full flex flex-col bg-white dark:bg-[#111813] relative">
          {/* Header */}
          <header className="h-16 border-b border-gray-100 dark:border-border-dark flex items-center justify-between px-6 bg-white/80 dark:bg-[#111813]/80 backdrop-blur-sm z-20">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${uploadStatus === 'ready' ? 'bg-green-500' : 'bg-slate-300 dark:bg-gray-600'}`}></span>
              <p className="text-sm font-medium text-slate-500 dark:text-gray-400">
                {uploadStatus === 'ready' ? selectedFile?.name : 'No document selected'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#1a261e] text-slate-400 dark:text-[#9db9a6] transition-colors">
                <span className="material-symbols-outlined text-[20px]">share</span>
              </button>
              <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#1a261e] text-slate-400 dark:text-[#9db9a6] transition-colors">
                <span className="material-symbols-outlined text-[20px]">more_vert</span>
              </button>
            </div>
          </header>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-6 pb-32 scrollbar-hide">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <div className="max-w-sm text-center">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-tr from-slate-100 to-slate-50 dark:from-[#1a2c20] dark:to-[#111813] flex items-center justify-center relative overflow-hidden">
                    <span className="material-symbols-outlined text-slate-300 dark:text-[#3b5443]" style={{ fontSize: '48px' }}>
                      chat_bubble_outline
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Ready to analyze</h2>
                  <p className="text-slate-500 dark:text-[#9db9a6]">
                    Upload a file on the left panel to start a conversation with your document.
                  </p>
                </div>

                {/* Suggested Prompts */}
                {uploadStatus === 'ready' && (
                  <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                    <button
                      onClick={() => setInputMessage('What are the key takeaways?')}
                      className="p-4 rounded-2xl border border-gray-200 dark:border-border-dark bg-slate-50 dark:bg-[#151f18] hover:border-primary transition-colors text-left"
                    >
                      <p className="text-xs text-slate-400 dark:text-gray-500 mb-1">Summarize</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-gray-300">What are the key takeaways?</p>
                    </button>
                    <button
                      onClick={() => setInputMessage('List all action items')}
                      className="p-4 rounded-2xl border border-gray-200 dark:border-border-dark bg-slate-50 dark:bg-[#151f18] hover:border-primary transition-colors text-left"
                    >
                      <p className="text-xs text-slate-400 dark:text-gray-500 mb-1">Analyze</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-gray-300">List all action items</p>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto py-8 space-y-6">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] p-4 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-primary text-black'
                          : 'bg-slate-100 dark:bg-[#1a261e] text-slate-900 dark:text-white'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-[#28392e] flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-600 dark:text-gray-400 text-[18px]">person</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-white via-white to-transparent dark:from-[#111813] dark:via-[#111813] dark:to-transparent pt-12">
            <div className="max-w-3xl mx-auto relative">
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <input
                  className="w-full h-14 pl-6 pr-14 rounded-full bg-slate-100 dark:bg-[#1a261e] border-2 border-transparent focus:border-primary/50 focus:bg-white dark:focus:bg-[#0c1610] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#5c7a66] outline-none transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uploadStatus !== 'ready'}
                  placeholder={uploadStatus === 'ready' ? 'Ask a question about your document...' : 'Upload a document to start chatting...'}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <button
                  className="absolute right-2 top-2 h-10 w-10 bg-slate-200 dark:bg-[#28392e] hover:bg-primary dark:hover:bg-primary text-slate-400 dark:text-[#5c7a66] hover:text-black dark:hover:text-black rounded-full flex items-center justify-center transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uploadStatus !== 'ready' || !inputMessage.trim() || isLoading}
                  onClick={handleSendMessage}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isLoading ? 'progress_activity' : 'arrow_upward'}
                  </span>
                </button>
              </div>
              <p className="text-center text-xs text-slate-400 dark:text-[#5c7a66] mt-3">
                AI can make mistakes. Please verify important information.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
