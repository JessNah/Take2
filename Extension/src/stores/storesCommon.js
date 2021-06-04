import { getInstaCart, getInstaItem } from "./instacartStore"
import { getAppleCart, getAppleItem} from "./appleStore"
import { getAmazonCart, getAmazonItem } from "./amazonStore"
import { SupportedSites } from "../utils/constants"
import { settings } from "../settings"
import { baseUrl } from '../../../Client/src/config';

export function getCart(currentStore, onSuccessHandler) {
    let cart = getDOMCart(currentStore);
    if(!settings.devMode){
        //use server data
        getInventory(cart, onSuccessHandler);
    } else {
        onSuccessHandler(cart);
    }
}

async function getInventory(cart, onSuccessHandler) {
    const [ inventroyItems ] = await Promise.all([
        fetch(`${baseUrl}/inventory-items`).then(res => res.json()).catch(err => err)
      ]);
    console.log(inventroyItems);
    processCart(cart, inventroyItems);
    onSuccessHandler(cart);
}

export function getDOMCart(currentStore) {
    switch(currentStore){
        case SupportedSites.INSTACART:
            return getInstaCart();
        case SupportedSites.APPLESTORE:
            return getAppleCart();
        case SupportedSites.AMAZON:
            return getAmazonCart();
        default:
            return [];
    }
}

export function getItem(currentStore) {
    switch(currentStore){
        case SupportedSites.INSTACART:
            return getInstaItem();
        case SupportedSites.APPLESTORE:
            return getAppleItem();
        case SupportedSites.AMAZON:
            return getAmazonItem();
        default:
            return {};
    }
}

export function analyzeCart(cart) {
    for(let item of cart){
        item.score = (Math.random() * 10) - 1; //Math.floor?, 
        //-1 so closer to 'good'.. smaller num, big number is bad
        if(item.score < 0){
            item.score = 0;
        }
        item.top3Metrics = {
            "Farm": Math.floor(Math.random() * 100),
            "Processing": Math.floor(Math.random() * 100),
            "Transport": Math.floor(Math.random() * 100)
        }
    }
    cart.sort(compare);
    return cart;
}

export function compare( a, b ) {
    if ( a.score > b.score ){
      return 1;
    }
    if ( a.score < b.score ){
      return -1;
    }
    return 0;
}

export function getCartAverageRating(cart) {
    let score = 0;
    for(let item of cart){
        score += item.score;
    }
    if(cart.length <= 0 ){
        return 0;
    }
    return score/cart.length;
}

export function processCart(cart, inventory) {
    for(let item of cart){
        const i = inventoryContains(inventory, item.name);
        if(i > -1){
            console.log("modifying item " + item.name + " with " + i);
            console.log(inventory[i]);
            const inventoryItem = inventory[i];
            item.score = inventoryItem.totalScore;
            item.details = inventoryItem.details;
            item.comments = inventoryItem.comments;
            item.stats = inventoryItem.stats;
            if(item.stats["Farm"]){
                item.top3Metrics["Farm"] = item.stats["Farm"];
            }
            if(item.stats["Processing"]){
                item.top3Metrics["Processing"] = item.stats["Processing"];
            }
            if(item.stats["Transport"]){
                item.top3Metrics["Transport"] = item.stats["Transport"];
            }
        }
    }
}

function inventoryContains(inventory, itemName) {    
    //exact match
    let matchCount = {}
    for(let i = 0; i < inventory.length; i++){
        const invName = inventory[i].name.toLowerCase().replace(/[^a-zA-Z ]/g, "").replace( /  +/g, ' ' ); //remove special chars and leave single white spaces only
        if(invName.includes("dairy herd")){
            continue;
        }
        const itName = itemName.toLowerCase().replace(/[^a-zA-Z ]/g, "").replace( /  +/g, ' ' ); //remove special chars and leave single white spaces only
        //special cases
        if(invName.includes("poultry") && itName.includes("chicken")){
            return i;
        }
        if(invName.includes(itName) || itName.includes(invName)){
            return i;
        }
        //handle plural
        const singInv = (invName.slice(-1) === "s") ? invName.slice(0, -1) : invName;
        const singItem = (itName.slice(-1) === "s") ? itName.slice(0, -1) : itName;
        if(singInv.includes(itName) || itName.includes(singInv) || singItem.includes(singInv) 
            || singInv.includes(singItem)){
            return i;
        }
        //try all words
        const inventoryWords = invName.split(" ");
        const itemWords = itName.split(" ");
        for(let j = 0; j < inventoryWords.length; j++){
            for(let k = 0; k < itemWords.length; k++){
                //exact match
                if(inventoryWords[j].includes(itemWords[k]) || itemWords[k].includes(inventoryWords[j])){
                    if(matchCount[i]){
                        matchCount[i] = [...matchCount[i], k];
                        continue;
                    } else {
                        matchCount[i] = [k];
                        continue;
                    }
                    // return i;
                }
                //singular
                const inventoryWord = (inventoryWords[j].slice(-1) === "s") ? inventoryWords[j].slice(0, -1) : inventoryWords[j];
                const itemWord = (itemWords[k].slice(-1) === "s") ? itemWords[k].slice(0, -1) : itemWords[k];
                if(inventoryWord.includes(itemWords[k]) || itemWord.includes(inventoryWords[j])
                    || inventoryWord.includes(itemWord) || itemWord.includes(inventoryWord)){
                    if(matchCount[i]){
                        matchCount[i] = [...matchCount[i], k];
                        continue;
                    } else {
                        matchCount[i] = [k];
                        continue;
                    }
                    // return i;
                }
            }
        }
    }
    let largestMatch = -1;
    let mostMatchesInventoryIndex = -1;
    for (const inventoryIndex in matchCount) {
        if(matchCount[inventoryIndex].length > largestMatch){
            mostMatchesInventoryIndex = inventoryIndex;
            largestMatch = matchCount[inventoryIndex].length;
        }
    }
    let matchedAtIndex = 9999999;
    let bestMatchingInventoryIndex = -1;
    for (const inventoryIndex in matchCount) {
        if(matchCount[inventoryIndex][0] < matchedAtIndex){
            bestMatchingInventoryIndex = inventoryIndex;
            matchedAtIndex = matchCount[inventoryIndex][0];
        }
    }
    if(mostMatchesInventoryIndex !== -1 && matchCount[mostMatchesInventoryIndex].length > 1){
        //more than 1 word matched. Prioritize this.
        return mostMatchesInventoryIndex;
    }
    if(matchedAtIndex !== 9999999){
        //otherwise, return result where the word that matched was one of the first words in the name.
        return bestMatchingInventoryIndex;
    }
    return -1;
}