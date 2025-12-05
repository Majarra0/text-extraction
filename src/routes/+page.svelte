<script>
    import { slide } from 'svelte/transition';

    let selectedFile = null;
    let resultText = '';

    function handleFileChange(event) {
        selectedFile = event.target.files[0];
        resultText = '';
    }

    async function analyzeImage() {
        if (!selectedFile) {
            alert('Please select an image first.');
            return;
        }

        resultText = '⏳ Analyzing... Please wait.';
        
        setTimeout(() => {
            if (selectedFile) {
                // إضافة محاكاة لنتيجة إيجابية أو تفصيلية
                resultText = `✅ Analysis Complete: The image '${selectedFile.name}' was successfully processed. Detected features include: High contrast, detailed edges, and strong saturation.`;
            }
        }, 2500); // زيادة المدة لجعل تأثير "Analyzing" واضحًا
    }
</script>

<style>
    /* تغيير الخط إلى Inter لجميع العناصر */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

    /* تدرج خفيف للخلفية بدلاً من اللون الرمادي الثابت */
    .bg-gradient-soft {
        background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%);
    }
</style>

<main class="flex flex-col min-h-screen font-inter bg-gradient-soft">

    <header class="bg-white shadow-sm border-b border-gray-100">
        <nav class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div class="text-xl font-extrabold text-blue-600 tracking-wider flex items-center">
                🖼️ <span class="ml-2 text-gray-800">VisionAI</span>
            </div>
            <ul class="flex space-x-8 text-gray-500 text-sm">
                <li><a href="#" class="hover:text-blue-600 transition duration-150">Home</a></li>
                <li><a href="#" class="hover:text-blue-600 transition duration-150">Pricing</a></li>
                <li><a href="#" class="hover:text-blue-600 transition duration-150">Docs</a></li>
            </ul>
        </nav>
    </header>

    <section class="flex flex-col items-center justify-center flex-1 p-8">
        <h1 class="text-4xl font-extrabold mb-4 text-gray-800 tracking-tight">AI Image Insight</h1>
        <p class="text-lg text-gray-500 mb-10">Upload any image to get an instant deep analysis.</p>

        <div 
            class="w-full max-w-lg bg-white transition duration-300   rounded-xl p-8 border border-gray-100"
        >
            <label for="image-upload" class="block mb-4 text-center text-sm font-medium text-gray-600">
                {selectedFile ? `File Selected: ${selectedFile.name}` : 'Select an image file (PNG, JPG, HEIC)'}
            </label>
            
            <input 
                id="image-upload"
                type="file" 
                accept="image/*" 
               
                class="hidden" 
            />
            
            <button 
                onclick={() => document.getElementById('image-upload').click()} 
                class="w-full mb-6 py-3 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition duration-200"
            >
                Browse Files
            </button>


            <button 
              
                class="w-full py-3 
                       bg-gradient-to-r from-blue-600 to-indigo-700 
                       hover:from-blue-700 hover:to-indigo-800 
                       text-white rounded-lg 
                       font-bold text-lg 
                       shadow-lg shadow-blue-300/50 
                       transition duration-300 ease-in-out transform hover:scale-[1.01]"
            >
                Analyze Image Now
            </button>
        </div>

        {#if resultText}
            <div 
                transition:slide
                class="mt-8 w-full max-w-lg bg-white shadow-xl rounded-xl p-6 border-l-4 border-blue-500 text-gray-800 animate-fadeIn"
            >
                <p class="font-semibold text-base leading-relaxed">
                    {resultText}
                </p>
            </div>
        {/if}
    </section>


    <footer class="bg-white border-t border-gray-100">
        <div class="max-w-7xl mx-auto px-4 py-4 text-center text-gray-400 text-xs">
            &copy; 2025 VisionAI. All rights reserved. Built with Svelte and Tailwind CSS.
        </div>
    </footer>

</main>