import { useEffect, useRef, useState } from "react"
import { PLATFORMS } from "../assets/assets";
import { ArrowRightIcon, CalendarIcon, ClockIcon, HistoryIcon, ImagePlusIcon, Loader2Icon, TimerIcon, Trash2Icon, Wand2Icon, XIcon } from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";


const AIComposer = () => {

  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("Professional");
  const [generateImage, setGenerateImage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [generations, setGenerations] = useState<any[]>([])

   // Scheduling state
   const [activeScheduler, setActiveScheduler] = useState<any>(null);
   const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
   const [scheduledDate, setScheduledDate] = useState("");
   const [scheduledTime, setScheduledTime] = useState("");
   const [scheduling, setScheduling] = useState(false);

   // Manual media upload state (photo/video)
   const [mediaFile, setMediaFile] = useState<File | null>(null);
   const [mediaPreview, setMediaPreview] = useState<string>("");
   const fileInputRef = useRef<HTMLInputElement>(null);

   const fetchGenerations = async () => {
    try {
      const { data } = await api.get("api/posts/generations")
      setGenerations(data)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message);
    }
   }

   useEffect(()=>{
    fetchGenerations()
   },[])

   const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if(!isImage && !isVideo){
      toast.error("Please select an image or video file");
      return;
    }

    const maxSizeMB = isVideo ? 50 : 10;
    if(file.size > maxSizeMB * 1024 * 1024){
      toast.error(`File too large. Max ${maxSizeMB}MB allowed for ${isVideo ? "videos" : "images"}`);
      return;
    }

    if(mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
   }

   const removeMedia = () => {
    if(mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview("");
    if(fileInputRef.current) fileInputRef.current.value = "";
   }

   const handleGenerate = async ()=>{
    if(!prompt && !mediaFile){
      toast.error("Please enter a prompt or upload an image/video");
      return;
    }
    setLoading(true)
    try {
      let data;
      if(mediaFile){
        const formData = new FormData();
        if(prompt) formData.append("prompt", prompt);
        formData.append("tone", tone);
        formData.append("generateImage", String(generateImage));
        formData.append("referenceImage", mediaFile);

        const response = await api.post("/api/posts/generate", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        data = response.data;
        console.log("Frontend API Response:", data);
      } else {
        const response = await api.post("/api/posts/generate", {prompt, tone, generateImage});
        data = response.data;
        console.log("Frontend API Response:", data);
      }

      setGenerations([data, ...generations]);
      setActiveScheduler(data)
      toast.success("Content generated!")
      setPrompt("");
      removeMedia();
    } catch (error: any) {
       toast.error(error?.response?.data?.message || error?.message);
    }finally{
      setLoading(false)
    }
   }

   const handleSchedule = async ()=>{
    if(!activeScheduler) return;
    if(selectedPlatforms.length === 0){
       toast.error("Select at least one platform");
      return;
    }
    if(!scheduledDate || !scheduledTime){
      toast.error("Select date and time");
      return;
    }

    const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
    setScheduling(true);
    try {
      if(mediaFile){
        // User uploaded their own photo/video - send as multipart form data
        const formData = new FormData();
        formData.append("content", activeScheduler.content);
        formData.append("platforms", JSON.stringify(selectedPlatforms));
        formData.append("scheduledFor", scheduledFor);
        formData.append("status", "scheduled");
        formData.append("media", mediaFile);

        await api.post("/api/posts", formData);
      } else {
        // No manual upload - fall back to AI-generated media (if any)
        await api.post("/api/posts", {
          content: activeScheduler.content,
          mediaUrl: activeScheduler.mediaUrl,
          mediaType: activeScheduler.mediaType,
          platforms: selectedPlatforms,
          scheduledFor,
          status: "scheduled",
        })
      }

        toast.success("AI Post scheduled!");
        setActiveScheduler(null)
        setSelectedPlatforms([]);
        setScheduledDate("");
        setScheduledTime("");
        removeMedia();
    } catch (error:any) {
      toast.error(error?.response?.data?.message || "Failed to schedule");
    }finally{
      setScheduling(false);
    }
   }

   const tones = ["Professional", "Creative", "Funny", "Minimalist", "Excited"];

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
      {/* Input Section */}
      <div className="space-y-6 text-center mt-20">
        <h1 className="text-3xl text-slate-700 tracking-tight">What should we create today?</h1>
        <div className="bg-white border border-slate-200 rounded-xl mt-12 overflow-hidden">
          <textarea 
          className="w-full px-6 py-6 bg-transparent border-none text-slate-900 placeholder-slate-400 outline-none resize-none h-28"
          placeholder="Share your idea... (e.g. A post about the launch of our new eco-friendly coffee beans)" value={prompt} onChange={(e)=> setPrompt(e.target.value)}/>
          
          {/* Manual photo/video upload preview */}
          {mediaPreview && (
            <div className="px-6 pb-4">
              <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                {mediaFile?.type.startsWith("video/") ? (
                  <video src={mediaPreview} className="w-full h-full object-cover"/>
                ) : (
                  <img src={mediaPreview} alt="Upload preview" className="w-full h-full object-cover"/>
                )}
                <button
                  onClick={removeMedia}
                  className="absolute top-1.5 right-1.5 size-6 rounded-full bg-slate-900/70 hover:bg-red-500 text-white transition-colors flex items-center justify-center"
                >
                  <XIcon className="size-3.5"/>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 text-sm p-4 border-t border-slate-100">
            <button type="button" title="Attach image or video" onClick={()=> fileInputRef.current?.click()} className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 p-2 rounded-lg">
              <ImagePlusIcon className="size-5"/>
            </button>

            <button onClick={()=> setGenerateImage(!generateImage)} className="flex items-center gap-3 bg-red-50 py-2 px-3 rounded-lg">
              <span>AI Image</span>
              <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${generateImage ? "bg-red-500" : "bg-slate-200"}`}>
                <span className={`pointer-events-none size-4 transform translate-y-0.5 rounded-full bg-white transition ${generateImage ? "translate-x-4.5" : "translate-x-0.5"}`}/>
              </div>
            </button>

            <button onClick={handleGenerate} disabled={loading} className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 px-4 py-2 rounded-lg">
              {loading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin"/>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  Generate
                  <ArrowRightIcon className="size-4"/>
                </>
              )}
            </button>

          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
              {tones.map((t)=>(
                <button key={t} onClick={()=> setTone(t) } className={`px-4 py-1.5 rounded-full text-sm transition-all border ${tone === t ? "bg-red-500 border-red-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  {t}
                </button>
              ))}
        </div>
      </div>

      {/* AI Generated Posts */}
      <div className="space-y-6 pt-12 border-t border-slate-100">
          <div className="flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-2">
              <HistoryIcon className="size-5"/>
              <h2 className="text-xl">Recent Generations</h2>
            </div>
            <span className="text-sm text-slate-500 bg-slate-50 px-2">{generations.length} total</span>
          </div>

           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {generations.map((gen)=>(
                <div key={gen._id} className="group bg-white rounded-2xl border border-slate-100 p-5 hover:border-red-200 transition-all relative overflow-hidden">
                  <div className="flex flex-col h-full space-y-4">

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 uppercase tracking-widest">{new Date(gen.createdAt).toLocaleString()}</span>
                      <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-md">{gen.tone}</span>
                    </div>

                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed flex-1">{gen.content}</p>

                    {gen.imageDescription && (
  <div className="mt-3 rounded-lg bg-slate-50 p-3">
    <p className="text-xs font-semibold text-slate-500 uppercase">
      Image Description
    </p>
    <p className="text-sm text-slate-600">
      {gen.imageDescription}
    </p>
  </div>
)}

{gen.hashtags && (
  <div className="mt-2">
    <p className="text-xs text-blue-600 break-words">
      {gen.hashtags}
    </p>
  </div>
)}

                    {gen.mediaUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-50 bg-slate-50">
                        <img src={gen.mediaUrl} alt="Gen" className="w-full aspect-video object-cover opacity-90 group-hover:opacity-100 transition-opacity"/>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <button 
                      onClick={()=> setActiveScheduler(gen)}
                      className="flex-1 bg-slate-100 hover:bg-red-500 hover:text-white text-slate-600 text-xs py-2.5 rounded-lg transition-all">
                        Schedule Post
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {
                generations.length === 0 && (
                  <div className="col-span-full py-20 text-center space-y-2">
                    <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
                      <Wand2Icon className="size-6" />
                    </div>
                    <p className="text-slate-400 text-sm">No content generated yet. Try generating some content using the AI.</p>
                  </div>
                )
              }
          </div>
      </div>

      {/* Scheduler Modal */}
      {activeScheduler && (
        <div className="fixed inset-0 min-h-screen z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">

            <div className="flex items-center justify-between px-8 py-4 border-b border-slate-100 bg-slate-50/30">
              <h3 className="text-slate-900">Schedule Generation</h3>
              <button onClick={()=>{ setActiveScheduler(null); removeMedia(); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                <XIcon className="size-5"/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">{activeScheduler.prompt}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
    {activeScheduler.content}
</p>

{!mediaFile && activeScheduler.mediaUrl && (
  <img
    src={activeScheduler.mediaUrl}
    alt="preview"
    className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-sm"
  />
)}

{activeScheduler.imageDescription && (
  <div className="mt-4 rounded-lg bg-slate-50 p-3">
    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
      Image Description
    </p>

    <p className="text-sm text-slate-700">
      {activeScheduler.imageDescription}
    </p>
  </div>
)}

{activeScheduler.hashtags && (
  <div className="mt-4 rounded-lg bg-blue-50 p-3">
    <p className="text-xs font-semibold text-blue-700 uppercase mb-2">
      Hashtags
    </p>

    <p className="text-sm text-blue-600 break-words whitespace-pre-wrap">
      {activeScheduler.hashtags}
    </p>
  </div>
)}
              </div>

              {/* Manual photo/video upload */}
              <div className="space-y-3">
                <label className="block text-xs text-slate-600 uppercase tracking-widest">
                  {activeScheduler.mediaUrl ? "Replace with your own photo/video" : "Attach photo/video"}
                </label>

                {mediaPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    {mediaFile?.type.startsWith("video/") ? (
                      <video src={mediaPreview} controls className="w-full aspect-video object-cover"/>
                    ) : (
                      <img src={mediaPreview} alt="Upload preview" className="w-full aspect-video object-cover"/>
                    )}
                    <button
                      onClick={removeMedia}
                      className="absolute top-2 right-2 p-2 rounded-full bg-slate-900/70 hover:bg-red-500 text-white transition-colors"
                    >
                      <Trash2Icon className="size-4"/>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={()=> fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-500 transition-colors"
                  >
                    <ImagePlusIcon className="size-6"/>
                    <span className="text-sm">Click to upload a photo or video</span>
                    <span className="text-xs text-slate-300">Images up to 10MB, videos up to 50MB</span>
                  </button>
                )}

              </div>
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-slate-50 space-y-8">
              {/* Options */}
              <div className="space-y-6">
                <div>
                  <label className="block text-xs text-slate-600 uppercase tracking-widest mb-4">Select Channels</label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p)=>{
                      const active = selectedPlatforms.includes(p.id);
                      return (
                        <button key={p.id} onClick={()=> setSelectedPlatforms((prev)=> (prev.includes(p.id) ? prev.filter((x)=>x !== p.id) : [...prev, p.id]))}
                        className={`p-2.5 rounded-md border text-xs ${active ? "bg-red-500/80 text-white" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                          <p.icon className="size-4.5"/>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <CalendarIcon className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="date" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-md text-slate-900 text-sm focus:outline-none transition-all" value={scheduledDate} onChange={(e)=>setScheduledDate(e.target.value)}/>
                  </div>
                  <div className="relative">
                    <ClockIcon className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="time" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-md text-slate-900 text-sm focus:outline-none transition-all" value={scheduledTime} onChange={(e)=>setScheduledTime(e.target.value)}/>
                  </div>
                </div>
              </div>
              <button onClick={handleSchedule} className="w-full flex items-center justify-center gap-2 py-3 rounded-md  bg-slate-200 text-slate-700 hover:bg-red-500 hover:text-white transition">
                {scheduling ? <Loader2Icon className="size-4 animate-spin"/> : <TimerIcon className="size-4"/>}
                 Schedule Post
              </button>
            </div>

          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

export default AIComposer