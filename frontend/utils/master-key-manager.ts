export const getMasterKey = () => {
    let masterKey = localStorage.getItem("MASTER_KEY");

    if (!masterKey) {
        // 在浏览器环境中，使用 prompt 提示用户输入
        masterKey = prompt("请输入 MASTER_KEY：");
        if (masterKey) {
            localStorage.setItem("MASTER_KEY", masterKey);
        } else {
            console.warn("用户未提供 MASTER_KEY。");
            return null;
        }
    }
    return masterKey;
};
