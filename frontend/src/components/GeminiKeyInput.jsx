import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Key } from "lucide-react";
import { toast } from "sonner";

export const useGeminiKey = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  return apiKey;
};

export const GeminiKeyInput = () => {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('gemini_api_key');
    if (stored) {
      setApiKey(stored);
      setIsSaved(true);
      setIsEditing(false);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter a valid API key");
      return;
    }
    localStorage.setItem('gemini_api_key', apiKey.trim());
    setIsSaved(true);
    setIsEditing(false);
    toast.success("API Key saved securely to your browser");
  };

  const handleClear = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setIsSaved(false);
    setIsEditing(true);
  };

  if (!isEditing && isSaved) {
    return (
      <div className="flex items-center justify-between bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-green-600" />
          <span className="font-semibold">AI Ready ✓</span>
        </div>
        <button 
          onClick={() => setIsEditing(true)} 
          className="text-sm underline text-green-700 hover:text-green-900"
        >
          change key
        </button>
      </div>
    );
  }

  return (
    <Card className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-100">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Key className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-purple-900">Enter your free Gemini API key to enable AI features</h3>
            <p className="text-sm text-purple-700 mt-1">
              Get your free API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold">Google AI Studio</a>
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <Input 
            type="password"
            placeholder="AIzaSy..." 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 bg-white border-purple-200 focus-visible:ring-purple-500"
          />
          <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white">
            Save Key
          </Button>
          {isSaved && (
            <Button variant="outline" onClick={handleClear} className="border-purple-200 text-purple-700 hover:bg-purple-100">
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GeminiKeyInput;
