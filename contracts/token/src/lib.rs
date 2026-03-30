#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String,
};

#[contracttype]
pub enum DataKey {
    Balance(Address),
    Admin,
    Name,
    Symbol,
    Decimals,
}

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String) {
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::Name, &name);
        env.storage().persistent().set(&DataKey::Symbol, &symbol);
        env.storage().persistent().set(&DataKey::Decimals, &7u32);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let current: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(current + amount));
        env.events().publish((symbol_short!("mint"),), (to, amount));
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let from_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        assert!(from_balance >= amount, "Insufficient balance");
        let to_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_balance - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_balance + amount));
        env.events()
            .publish((symbol_short!("transfer"),), (from, to, amount));
    }

    pub fn balance(env: Env, of: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(of))
            .unwrap_or(0)
    }

    pub fn name(env: Env) -> String {
        env.storage().persistent().get(&DataKey::Name).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().persistent().get(&DataKey::Symbol).unwrap()
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Decimals)
            .unwrap_or(7)
    }
}

mod test;