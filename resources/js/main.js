//to app window draggable
function drag(){
    Neutralino.window.setDraggableRegion('titlebar',{
        exclude:[document.getElementById('controls')]
    });
}

let data_list=[];//saving the data as a list for easy manipulation
let lastClipboardText="";//to prevent duplicate entries when copying
let isSaving=false;//To prevent consecutive saving operations
//storing the copied data in the neutralino storage as a JSON string
async function sync_to_disk(){
    if(isSaving){return;}
    isSaving=true;
    try{
        await Neutralino.storage.setData('clipHistory',JSON.stringify(data_list));
    } 
    catch(e){
        console.error("Storage failed",e);
    } 
    finally{
        isSaving=false;
    }
}
//reads the stored data and updates the list when the app starts
async function load_data(){
    try{
        const saved=await Neutralino.storage.getData('clipHistory');
        if(saved) data_list=JSON.parse(saved);
    } 
    catch(e){
        data_list=[];
    }
}
//adds a new clip to the list, ensuring no duplicates
function add_clip(text){
    if(!text || text.trim()===""){return false;}
    const existing=data_list.indexOf(text);
    if(existing !== -1){data_list.splice(existing,1);}
    data_list.unshift(text);
    if(data_list.length > 10){data_list.length=10;} //storing a max of 10 clips
    return true;
}
//Clipboard monitor
async function start(){
    await load_data();
    try{
        lastClipboardText=await Neutralino.clipboard.readText()||"";
    } 
    catch(_){}
    render();
    setInterval(async() =>{
        try{
            const text=await Neutralino.clipboard.readText();
            if(text && text !== lastClipboardText){
                lastClipboardText=text;
                if(add_clip(text)){
                    await sync_to_disk();
                    render();
                }
            }
        } 
        catch(e){
            if(!e.message?.includes('non-text')){console.warn("Clipboard read:", e);}
        }
    },800);
}
//Searching and filtering the clips based on user input
function get_filtered(){
    const query=document.getElementById('search-input').value.trim().toLowerCase();
    if(!query){return data_list;}
    return data_list.filter(c => c.toLowerCase().includes(query));
}
//Copying the item 
async function copy_item(text){
    lastClipboardText=text;
    await Neutralino.clipboard.writeText(text);
    add_clip(text); //move the copied item to the top
    await sync_to_disk();
    render();
    await Neutralino.os.showNotification("Clipvault","Copied to clipboard");
}
//Deleting the item 
async function del_item(e,text){
    e.stopPropagation();
    const masterIndex=data_list.indexOf(text);
    if(masterIndex !== -1){data_list.splice(masterIndex,1);}
    await sync_to_disk();
    render();
}
document.getElementById('search-input').addEventListener('input',() => render());
//Render
function render(){
    const listDiv=document.getElementById('clip-list');
    const countEl=document.getElementById('clip-count');
    if(!listDiv){return;}

    const filtered=get_filtered();
    countEl.textContent=`${data_list.length} item${data_list.length !== 1 ? 's' : ''}`;

    if(filtered.length === 0){
        listDiv.innerHTML=`
            <div id="empty-state">
                <span class="material-symbols-outlined" style="font-size: 38px; margin-bottom: 8px;">
                    content_paste
                </span>
                <p>${data_list.length===0 ? 'Watchu doin\' - copy something man!' : 'No results'}</p>
            </div>`;
        return;
    }
    listDiv.innerHTML='';
    filtered.forEach((clip, i) =>{
        const div=document.createElement('div');
        div.className='clip-item';
        div.style.animationDelay=`${i * 0.025}s`;

        const idx=document.createElement('span');
        idx.className='clip-index';
        idx.textContent=i + 1;

        const textSpan=document.createElement('span');
        textSpan.className='clip-text';
        textSpan.textContent=clip;

        const btn=document.createElement('button');
        btn.className='clip-delete-btn';
        btn.title='Delete';
        btn.innerHTML=`<svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`;

        div.appendChild(idx);
        div.appendChild(textSpan);
        div.appendChild(btn);

        div.addEventListener('click',() => copy_item(clip));
        btn.addEventListener('click',(e) => del_item(e, clip));
        listDiv.appendChild(div);
    });
}
//Setting up the system tray menu for quick access and app control
function set_tray(){
    if(NL_MODE != "window"){return;}
    Neutralino.os.setTray({
        menuItems: [
           {id: "SHOW",text: "Show Clipvault"},
           {id: "SEP",text: "-" },
           {id: "VERSION",text: `Version ${NL_VERSION}`},
           {id: "SEP2",text: "-"},
           {id: "QUIT",text: "Quit"}
        ]
    });
}
//Handling tray menu actions and window close event to hide the app instead of exiting
function onTrayMenuItemClicked(event){
    switch(event.detail.id){
        case "SHOW":Neutralino.window.show(); break;
        case "VERSION":Neutralino.os.showMessageBox("Version",`v${NL_VERSION}`); break;
        case "QUIT":Neutralino.app.exit(); break;
    }
}
//On window close, hide the app instead of exiting to keep it running in the background
function onWindowClose(){
    Neutralino.window.hide();
}
//press escape key to hide the window
document.addEventListener('keydown',(e) =>{
    if(e.key === 'Escape'){Neutralino.window.hide();}
});
//Initializing the Neutralino app and setting up event listeners
Neutralino.init();
Neutralino.events.on("trayMenuItemClicked",onTrayMenuItemClicked);
Neutralino.events.on("windowClose",onWindowClose);
//When the app is ready, display the app info, make the window draggable, start the clipboard monitoring, and set up the system tray if not on macOS
Neutralino.events.on("ready",() =>{
    document.getElementById('info').textContent=`${NL_APPID} · ${NL_OS} · v${NL_VERSION}`;
    drag();
    start();
    if(NL_OS != "Darwin"){set_tray();}
});